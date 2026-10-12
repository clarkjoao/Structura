// Package relay is the long-lived session handler set for protocol v3, a port of
// server/src/collab/relay.ts. A relay holds sockets and nothing else that matters: every piece of
// session state lives in the store, so any number of relays can serve one room and losing one
// loses only its sockets, which reconnect elsewhere.
package relay

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"log"
	"sync"
	"time"

	"github.com/clarkjoao/structura/go-server/internal/protocol"
	"github.com/clarkjoao/structura/go-server/internal/session"
	"github.com/clarkjoao/structura/go-server/internal/store"
)

// Conn is what a relay needs from a socket. Send and Close must not block.
type Conn interface {
	Send(frame []byte)
	Close(code int, reason string)
	// Buffered is the number of bytes queued and not yet written.
	Buffered() int
}

// Options tune a relay; zero values take the TypeScript relay's defaults.
type Options struct {
	MaxParticipants  int
	HostGrace        time.Duration
	HostLease        time.Duration
	HostLeaseRenew   time.Duration
	MemberTTL        time.Duration
	MemberRenew      time.Duration
	ReaperInterval   time.Duration
	RoomCheck        time.Duration
	CursorFlush      time.Duration
	PatchRate        Rate
	CursorRate       Rate
	LockRate         Rate
	LossyQueueBytes  int
	MaxQueueBytes    int
	Now              func() int64
	Log              func(format string, args ...any)
	DisableTimers    bool
	OperationTimeout time.Duration
}

func (o *Options) defaults() {
	if o.MaxParticipants == 0 {
		o.MaxParticipants = protocol.MaxParticipants
	}
	if o.HostGrace == 0 {
		o.HostGrace = protocol.HostGraceMs * time.Millisecond
	}
	if o.HostLease == 0 {
		o.HostLease = 5 * time.Second
	}
	if o.HostLeaseRenew == 0 {
		o.HostLeaseRenew = 2 * time.Second
	}
	if o.MemberTTL == 0 {
		o.MemberTTL = 30 * time.Second
	}
	if o.MemberRenew == 0 {
		o.MemberRenew = 10 * time.Second
	}
	if o.ReaperInterval == 0 {
		o.ReaperInterval = time.Second
	}
	if o.RoomCheck == 0 {
		o.RoomCheck = 2 * time.Second
	}
	if o.CursorFlush == 0 {
		o.CursorFlush = 50 * time.Millisecond
	}
	if o.PatchRate.Rate == 0 {
		o.PatchRate = Rate{Rate: 30, Burst: 60}
	}
	if o.CursorRate.Rate == 0 {
		o.CursorRate = Rate{Rate: 20, Burst: 20}
	}
	if o.LockRate.Rate == 0 {
		o.LockRate = Rate{Rate: 10, Burst: 20}
	}
	if o.LossyQueueBytes == 0 {
		o.LossyQueueBytes = 1024 * 1024
	}
	if o.MaxQueueBytes == 0 {
		o.MaxQueueBytes = 8 * 1024 * 1024
	}
	if o.Now == nil {
		o.Now = store.NowMs
	}
	if o.Log == nil {
		o.Log = log.Printf
	}
	if o.OperationTimeout == 0 {
		o.OperationTimeout = 10 * time.Second
	}
}

const (
	phaseNew     = "new"
	phaseSeeding = "seeding"
	phaseJoining = "joining"
	phaseJoined  = "joined"
	phaseClosed  = "closed"
)

type connState struct {
	id   string
	conn Conn

	mu         sync.Mutex
	phase      string
	roomID     string
	clientID   string
	role       string
	user       protocol.User
	delivered  int64
	buffer     []store.RoomEvent
	buffering  bool
	seedChunks int
	locks      map[string]bool

	patchBucket  *TokenBucket
	cursorBucket *TokenBucket
	lockBucket   *TokenBucket
}

func (s *connState) snapshot() (phase, roomID, clientID, role string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.phase, s.roomID, s.clientID, s.role
}

type localRoom struct {
	epoch       string
	conns       map[*connState]bool
	ready       chan struct{}
	unsubscribe store.Unsubscribe
	unsubPres   store.Unsubscribe
	cursors     map[string]protocol.CursorEntry
}

// Relay serves protocol v3 over any socket transport.
type Relay struct {
	store store.Shared
	opt   Options

	mu      sync.Mutex
	conns   map[*connState]bool
	rooms   map[string]*localRoom
	stopped bool
	stop    chan struct{}
	wg      sync.WaitGroup
}

// New starts a relay on a store, with its background timers.
func New(s store.Shared, opt Options) *Relay {
	opt.defaults()
	r := &Relay{
		store: s,
		opt:   opt,
		conns: map[*connState]bool{},
		rooms: map[string]*localRoom{},
		stop:  make(chan struct{}),
	}
	if !opt.DisableTimers {
		r.every(opt.HostLeaseRenew, r.renewHostLeases)
		r.every(opt.MemberRenew, r.renewMembers)
		r.every(opt.ReaperInterval, r.reap)
		r.every(opt.RoomCheck, r.checkRooms)
		r.every(opt.CursorFlush, func(context.Context) { r.flushCursors() })
	}
	return r
}

// Handlers are what a transport calls for one socket. OnMessage must be called sequentially, in
// arrival order; OnClose once, after the last OnMessage.
type Handlers struct {
	OnMessage func(raw []byte)
	OnClose   func()
}

func newID() string {
	var b [16]byte
	_, _ = rand.Read(b[:])
	return hex.EncodeToString(b[:])
}

// Connect registers a socket.
func (r *Relay) Connect(conn Conn) Handlers {
	state := &connState{
		id:           newID(),
		conn:         conn,
		phase:        phaseNew,
		locks:        map[string]bool{},
		patchBucket:  NewTokenBucket(r.opt.PatchRate, r.opt.Now),
		cursorBucket: NewTokenBucket(r.opt.CursorRate, r.opt.Now),
		lockBucket:   NewTokenBucket(r.opt.LockRate, r.opt.Now),
	}
	r.mu.Lock()
	r.conns[state] = true
	r.mu.Unlock()

	return Handlers{
		OnMessage: func(raw []byte) {
			if n := protocol.UTF16LenBytes(raw); n > protocol.MaxFrameChars {
				r.sendError(state, protocol.ErrTooLarge, "Frame too large", protocol.IntPtr(protocol.MaxFrameChars), protocol.IntPtr(n))
				return
			}
			message, ok := protocol.ParseClientMessage(raw)
			if !ok {
				r.sendError(state, protocol.ErrInvalidMessage, "Malformed or unknown message", nil, nil)
				return
			}
			ctx, cancel := context.WithTimeout(context.Background(), r.opt.OperationTimeout)
			defer cancel()
			if err := r.handle(ctx, state, message); err != nil {
				r.opt.Log("[collab] handler failed: %v", err)
				r.sendError(state, protocol.ErrUnavailable, "Temporary failure, retry", nil, nil)
			}
		},
		OnClose: func() {
			ctx, cancel := context.WithTimeout(context.Background(), r.opt.OperationTimeout)
			defer cancel()
			if err := r.disconnect(ctx, state); err != nil {
				r.opt.Log("[collab] disconnect failed: %v", err)
			}
		},
	}
}

// Stop closes every socket (clients reconnect to another relay) and stops the timers.
func (r *Relay) Stop() {
	r.mu.Lock()
	if r.stopped {
		r.mu.Unlock()
		return
	}
	r.stopped = true
	close(r.stop)
	states := make([]*connState, 0, len(r.conns))
	for s := range r.conns {
		states = append(states, s)
	}
	r.mu.Unlock()
	r.wg.Wait()
	ctx, cancel := context.WithTimeout(context.Background(), r.opt.OperationTimeout)
	defer cancel()
	for _, s := range states {
		s.conn.Close(1001, "server_shutdown")
		_ = r.disconnect(ctx, s)
	}
}

// ── Dispatch ────────────────────────────────────────────────────────────────

func (r *Relay) handle(ctx context.Context, state *connState, m *protocol.ClientMessage) error {
	if phase, _, _, _ := state.snapshot(); phase == phaseClosed {
		return nil
	}
	switch m.Type {
	case protocol.TypePing:
		r.send(state, protocol.MustMarshal(protocol.Simple{Type: "pong"}))
		return nil
	case protocol.TypePong:
		return nil
	case protocol.TypeCreate:
		return r.handleCreate(ctx, state, m)
	case protocol.TypeSeedChunk:
		return r.handleSeedChunk(ctx, state, m)
	case protocol.TypeSeedCommit:
		return r.handleSeedCommit(ctx, state)
	case protocol.TypeJoin:
		return r.handleJoin(ctx, state, m)
	case protocol.TypePatch:
		return r.handlePatch(ctx, state, m)
	case protocol.TypeLock:
		return r.handleLock(ctx, state, m.Action, m.EntityIDs)
	case protocol.TypeCursor:
		r.handleCursor(state, m)
		return nil
	default: // protocol.TypeClose: ParseClientMessage accepts no other type
		return r.handleClose(ctx, state)
	}
}

// ── Create and seed ─────────────────────────────────────────────────────────

func (r *Relay) handleCreate(ctx context.Context, state *connState, m *protocol.ClientMessage) error {
	if phase, _, _, _ := state.snapshot(); phase != phaseNew {
		r.sendError(state, protocol.ErrAlreadyJoined, "Already in a room", nil, nil)
		return nil
	}
	if m.Protocol != protocol.Version {
		r.refuseProtocol(state)
		return nil
	}
	if refusal := session.CheckCreate(m); refusal != nil {
		r.send(state, refusal)
		return nil
	}
	hostToken := session.NewHostToken()
	if m.HostToken != nil {
		hostToken = *m.HostToken
	}
	created, err := r.store.CreateRoom(ctx, store.CreateInput{
		RoomID:        m.RoomID,
		HostTokenHash: session.HashToken(hostToken),
		HostUser:      m.User,
		SeedChunks:    m.SeedChunks,
		Now:           r.opt.Now(),
	})
	if err != nil {
		return err
	}
	if !created {
		r.sendError(state, protocol.ErrRoomExists, "Room already exists", nil, nil)
		return nil
	}
	state.mu.Lock()
	state.phase = phaseSeeding
	state.roomID = m.RoomID
	state.clientID = m.User.ID
	state.user = m.User
	state.role = "host"
	state.seedChunks = m.SeedChunks
	state.mu.Unlock()
	if err := r.store.RenewHostLease(ctx, m.RoomID, r.opt.Now()+r.opt.HostLease.Milliseconds()); err != nil {
		return err
	}
	r.send(state, protocol.MustMarshal(protocol.Created{Type: "created", RoomID: m.RoomID, ClientID: m.User.ID, HostToken: hostToken}))
	return nil
}

func (r *Relay) handleSeedChunk(ctx context.Context, state *connState, m *protocol.ClientMessage) error {
	state.mu.Lock()
	phase, roomID, chunks := state.phase, state.roomID, state.seedChunks
	state.mu.Unlock()
	if phase != phaseSeeding || roomID == "" {
		r.sendError(state, protocol.ErrNotJoined, "No seed in progress", nil, nil)
		return nil
	}
	if m.Index < 0 || m.Index >= chunks || m.DataUnits > protocol.ChunkChars {
		r.sendError(state, protocol.ErrInvalidSeed, "Chunk out of range", nil, nil)
		return nil
	}
	return r.store.AppendSeedChunk(ctx, roomID, m.Index, string(m.Data))
}

func (r *Relay) handleSeedCommit(ctx context.Context, state *connState) error {
	state.mu.Lock()
	phase, roomID, user := state.phase, state.roomID, state.user
	state.mu.Unlock()
	if phase != phaseSeeding || roomID == "" {
		r.sendError(state, protocol.ErrNotJoined, "No seed in progress", nil, nil)
		return nil
	}
	result, err := r.store.CommitSeed(ctx, roomID)
	if err != nil {
		return err
	}
	if !result.OK {
		if err := r.store.DiscardRoom(ctx, roomID); err != nil {
			return err
		}
		state.mu.Lock()
		state.phase = phaseNew
		state.roomID = ""
		state.mu.Unlock()
		r.sendError(state, protocol.ErrInvalidSeed, "The seed could not be read", nil, nil)
		return nil
	}

	participant := protocol.Participant{ClientID: user.ID, User: user, Role: "host"}
	now := r.opt.Now()
	if _, err := r.store.AddMember(ctx, roomID, participant, state.id, now+r.opt.MemberTTL.Milliseconds(), r.opt.MaxParticipants, now); err != nil {
		return err
	}
	state.mu.Lock()
	state.phase = phaseJoining
	state.buffering = true
	state.buffer = nil
	state.mu.Unlock()
	meta, err := r.store.GetMeta(ctx, roomID)
	if err != nil {
		return err
	}
	epoch := ""
	if meta != nil {
		epoch = meta.Epoch
	}
	if err := r.attach(ctx, state, roomID, epoch); err != nil {
		return err
	}
	if err := r.store.MarkHostOnline(ctx, roomID); err != nil {
		return err
	}
	catchup := []protocol.Entry{}
	r.send(state, protocol.MustMarshal(protocol.Joined{
		Type:            "joined",
		ClientID:        participant.ClientID,
		Role:            "host",
		Version:         0,
		Participants:    []protocol.Participant{participant},
		MaxParticipants: r.opt.MaxParticipants,
		HostOnline:      true,
		Epoch:           epoch,
		Catchup:         &catchup,
	}))
	r.finishJoin(state, 0)
	r.opt.Log("[collab] room opened: %s", roomID)
	return nil
}

// ── Join ────────────────────────────────────────────────────────────────────

func (r *Relay) handleJoin(ctx context.Context, state *connState, m *protocol.ClientMessage) error {
	if phase, _, _, _ := state.snapshot(); phase != phaseNew {
		r.sendError(state, protocol.ErrAlreadyJoined, "Already in a room", nil, nil)
		return nil
	}
	if m.Protocol != protocol.Version {
		r.refuseProtocol(state)
		return nil
	}
	meta, err := r.store.GetMeta(ctx, m.RoomID)
	if err != nil {
		return err
	}
	switch {
	case meta == nil:
		r.sendError(state, protocol.ErrRoomUnknown, "Room unknown", nil, nil)
		return nil
	case meta.Status == store.StatusSeeding:
		r.sendError(state, protocol.ErrNotReady, "Session not ready", nil, nil)
		return nil
	case meta.Status == store.StatusClosed:
		r.sendError(state, protocol.ErrSessionClosed, "Session ended", nil, nil)
		return nil
	}

	role := "guest"
	if m.HostToken != nil {
		if !session.TokenMatches(*m.HostToken, meta.HostTokenHash) {
			r.sendError(state, protocol.ErrUnauthorized, "Invalid host credential", nil, nil)
			return nil
		}
		role = "host"
	}

	roomID := m.RoomID
	participant := protocol.Participant{ClientID: m.User.ID, User: m.User, Role: role}
	now := r.opt.Now()
	added, err := r.store.AddMember(ctx, roomID, participant, state.id, now+r.opt.MemberTTL.Milliseconds(), r.opt.MaxParticipants, now)
	if err != nil {
		return err
	}
	if !added.OK {
		r.sendError(state, protocol.ErrRoomFull, "Room is full", protocol.IntPtr(r.opt.MaxParticipants), nil)
		state.conn.Close(1008, "room_full")
		state.mu.Lock()
		state.phase = phaseClosed
		state.mu.Unlock()
		return nil
	}

	state.mu.Lock()
	state.phase = phaseJoining
	state.roomID = roomID
	state.clientID = participant.ClientID
	state.user = m.User
	state.role = role
	state.buffering = true
	state.buffer = nil
	state.mu.Unlock()
	if err := r.attach(ctx, state, roomID, meta.Epoch); err != nil {
		return err
	}

	if role == "host" {
		if err := r.store.RenewHostLease(ctx, roomID, r.opt.Now()+r.opt.HostLease.Milliseconds()); err != nil {
			return err
		}
		online, err := r.store.IsHostOnline(ctx, roomID)
		if err != nil {
			return err
		}
		if err := r.store.MarkHostOnline(ctx, roomID); err != nil {
			return err
		}
		if !online {
			back := true
			if err := r.store.PublishPresence(ctx, roomID, store.PresenceEvent{Kind: "host:status", Online: &back}); err != nil {
				return err
			}
		}
	}

	participants, err := r.store.ListMembers(ctx, roomID, r.opt.Now())
	if err != nil {
		return err
	}
	hostOnline, err := r.store.IsHostOnline(ctx, roomID)
	if err != nil {
		return err
	}
	joined := protocol.Joined{
		Type:            "joined",
		ClientID:        participant.ClientID,
		Role:            role,
		Participants:    participants,
		MaxParticipants: r.opt.MaxParticipants,
		HostOnline:      hostOnline,
		Epoch:           meta.Epoch,
	}

	// A resume is only meaningful within the incarnation it was taken from.
	var catchup []protocol.Entry
	resumed := false
	if m.ResumeFrom != nil && m.ResumeEpoch != nil && *m.ResumeEpoch == meta.Epoch {
		catchup, resumed, err = r.store.ReadEntries(ctx, roomID, *m.ResumeFrom)
		if err != nil {
			return err
		}
	}

	if resumed {
		version := *m.ResumeFrom
		if len(catchup) > 0 {
			version = catchup[len(catchup)-1].Version
		}
		joined.Version = version
		joined.Catchup = &catchup
		r.send(state, protocol.MustMarshal(joined))
		r.finishJoin(state, version)
	} else {
		snapshot, err := r.store.ReadSnapshot(ctx, roomID)
		if err != nil {
			return err
		}
		if snapshot == nil {
			r.detach(state)
			r.sendError(state, protocol.ErrSessionClosed, "Session ended", nil, nil)
			return nil
		}
		joined.Version = snapshot.Version
		r.send(state, protocol.MustMarshal(joined))
		for _, frame := range session.SnapshotFrames(snapshot, protocol.ChunkChars) {
			r.send(state, frame)
		}
		r.finishJoin(state, snapshot.Version)
	}

	count := len(participants)
	return r.store.PublishPresence(ctx, roomID, store.PresenceEvent{Kind: "peer:joined", Participant: &participant, ParticipantCount: &count})
}

// finishJoin flushes what arrived during the join, then goes live.
func (r *Relay) finishJoin(state *connState, version int64) {
	state.mu.Lock()
	defer state.mu.Unlock()
	state.delivered = version
	buffered := state.buffer
	state.buffer = nil
	state.buffering = false
	if state.phase == phaseClosed {
		return
	}
	state.phase = phaseJoined
	for _, event := range buffered {
		r.deliverLocked(state, event)
	}
}

// ── Edits ───────────────────────────────────────────────────────────────────

func (r *Relay) handlePatch(ctx context.Context, state *connState, m *protocol.ClientMessage) error {
	state.mu.Lock()
	phase, roomID, clientID, delivered := state.phase, state.roomID, state.clientID, state.delivered
	state.mu.Unlock()
	if phase != phaseJoined || roomID == "" || clientID == "" {
		r.sendError(state, protocol.ErrNotJoined, "Join a room first", nil, nil)
		return nil
	}
	if !state.patchBucket.Take() {
		r.send(state, protocol.MustMarshal(protocol.Ack{Type: "ack", OpID: m.OpID, Applied: false, Version: delivered}))
		r.sendError(state, protocol.ErrRateLimited, "Too many edits", nil, nil)
		return nil
	}
	result, err := r.store.ApplyPatch(ctx, roomID, store.ApplyInput{
		Patch: m.Patch, SenderVersion: m.BaseVersion, SenderID: clientID, OpID: m.OpID,
	})
	if err != nil {
		// Refused, whether or not it landed: if it did, its entry still arrives and the client
		// takes it as a remote change, so the sender never waits on an answer that never comes.
		r.send(state, protocol.MustMarshal(protocol.Ack{Type: "ack", OpID: m.OpID, Applied: false, Version: delivered}))
		return err
	}
	if result.Status == store.NotOpen {
		state.mu.Lock()
		delivered = state.delivered
		state.mu.Unlock()
		r.send(state, protocol.MustMarshal(protocol.Ack{Type: "ack", OpID: m.OpID, Applied: false, Version: delivered}))
		return nil
	}
	r.send(state, protocol.MustMarshal(protocol.Ack{Type: "ack", OpID: m.OpID, Applied: result.Status == store.Applied, Version: result.Version}))
	return nil
}

// forEachLimited runs fn over items with bounded concurrency.
func forEachLimited(items []string, limit int, fn func(string) error) error {
	var wg sync.WaitGroup
	var mu sync.Mutex
	var first error
	sem := make(chan struct{}, limit)
	for _, item := range items {
		wg.Add(1)
		sem <- struct{}{}
		go func(item string) {
			defer wg.Done()
			defer func() { <-sem }()
			if err := fn(item); err != nil {
				mu.Lock()
				if first == nil {
					first = err
				}
				mu.Unlock()
			}
		}(item)
	}
	wg.Wait()
	return first
}

// handleLock takes, renews or frees the locks a message names — one entity or a whole
// multi-selection — for one rate-limit token either way.
func (r *Relay) handleLock(ctx context.Context, state *connState, action string, entityIDs []string) error {
	phase, roomID, clientID, _ := state.snapshot()
	if phase != phaseJoined || roomID == "" || clientID == "" {
		r.sendError(state, protocol.ErrNotJoined, "Join a room first", nil, nil)
		return nil
	}
	if !state.lockBucket.Take() {
		r.sendError(state, protocol.ErrRateLimited, "Too many locks", nil, nil)
		return nil
	}
	ttl := protocol.LockTTLMs
	if action == "release" {
		return forEachLimited(entityIDs, 16, func(entityID string) error {
			state.mu.Lock()
			delete(state.locks, entityID)
			state.mu.Unlock()
			released, err := r.store.ReleaseLock(ctx, roomID, entityID, clientID)
			if err != nil || !released {
				return err
			}
			return r.store.PublishPresence(ctx, roomID, store.PresenceEvent{Kind: "lock", EntityID: entityID, TTLMs: &ttl})
		})
	}
	return forEachLimited(entityIDs, 16, func(entityID string) error {
		state.mu.Lock()
		allowed := state.locks[entityID] || len(state.locks) < protocol.MaxLocksPerClient
		state.mu.Unlock()
		granted, holder := false, ""
		if allowed {
			var err error
			granted, holder, err = r.store.AcquireLock(ctx, roomID, entityID, clientID, time.Duration(ttl)*time.Millisecond)
			if err != nil {
				return err
			}
		}
		state.mu.Lock()
		if granted {
			state.locks[entityID] = true
		} else {
			delete(state.locks, entityID)
		}
		state.mu.Unlock()
		if action == "acquire" || !granted {
			var h *string
			if holder != "" {
				h = &holder
			}
			r.send(state, protocol.MustMarshal(protocol.LockResult{Type: "lock:result", EntityID: entityID, Granted: granted, Holder: h}))
		}
		if granted {
			return r.store.PublishPresence(ctx, roomID, store.PresenceEvent{Kind: "lock", EntityID: entityID, Holder: &clientID, TTLMs: &ttl})
		}
		return nil
	})
}

func (r *Relay) handleCursor(state *connState, m *protocol.ClientMessage) {
	phase, roomID, clientID, _ := state.snapshot()
	if phase != phaseJoined || roomID == "" || clientID == "" {
		return
	}
	if !state.cursorBucket.Take() {
		return
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	if room := r.rooms[roomID]; room != nil {
		room.cursors[clientID] = protocol.CursorEntry{ClientID: clientID, Cursor: m.Cursor, ActiveElementID: m.ActiveElementID}
	}
}

func (r *Relay) handleClose(ctx context.Context, state *connState) error {
	phase, roomID, _, role := state.snapshot()
	if phase != phaseJoined || role != "host" || roomID == "" {
		r.sendError(state, protocol.ErrUnauthorized, "Only the host can end the session", nil, nil)
		return nil
	}
	_, err := r.store.CloseRoom(ctx, roomID, protocol.ReasonHostClosed)
	return err
}

// ── Room attachment and fan-out ─────────────────────────────────────────────

func (r *Relay) attach(ctx context.Context, state *connState, roomID, epoch string) error {
	r.mu.Lock()
	room := r.rooms[roomID]
	if room != nil && room.epoch != epoch {
		// A stale subscription to an earlier incarnation: it must not serve this one.
		r.mu.Unlock()
		r.dropLocalRoom(roomID, room)
		r.mu.Lock()
		room = r.rooms[roomID]
	}
	creating := false
	if room == nil {
		room = &localRoom{
			epoch:   epoch,
			conns:   map[*connState]bool{},
			ready:   make(chan struct{}),
			cursors: map[string]protocol.CursorEntry{},
		}
		r.rooms[roomID] = room
		creating = true
	}
	room.conns[state] = true
	r.mu.Unlock()

	if creating {
		unsub, err := r.store.Subscribe(ctx, roomID, func(event store.RoomEvent) { r.onRoomEvent(roomID, event) })
		var unsubPres store.Unsubscribe
		if err == nil {
			unsubPres, err = r.store.SubscribePresence(ctx, roomID, func(event store.PresenceEvent) { r.onPresence(roomID, event) })
		}
		r.mu.Lock()
		room.unsubscribe, room.unsubPres = unsub, unsubPres
		r.mu.Unlock()
		close(room.ready)
		return err
	}
	select {
	case <-room.ready:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

func (room *localRoom) release() {
	<-room.ready
	if room.unsubscribe != nil {
		room.unsubscribe()
	}
	if room.unsubPres != nil {
		room.unsubPres()
	}
}

func (r *Relay) detach(state *connState) {
	_, roomID, _, _ := state.snapshot()
	r.mu.Lock()
	room := r.rooms[roomID]
	if room == nil {
		r.mu.Unlock()
		return
	}
	delete(room.conns, state)
	empty := len(room.conns) == 0
	if empty {
		delete(r.rooms, roomID)
	}
	r.mu.Unlock()
	if empty {
		room.release()
	}
}

func (r *Relay) roomConns(roomID string) []*connState {
	r.mu.Lock()
	defer r.mu.Unlock()
	room := r.rooms[roomID]
	if room == nil {
		return nil
	}
	out := make([]*connState, 0, len(room.conns))
	for s := range room.conns {
		out = append(out, s)
	}
	return out
}

func (r *Relay) onRoomEvent(roomID string, event store.RoomEvent) {
	for _, state := range r.roomConns(roomID) {
		state.mu.Lock()
		switch {
		case state.phase == phaseJoining && state.buffering:
			state.buffer = append(state.buffer, event)
		case state.phase == phaseJoined:
			r.deliverLocked(state, event)
		}
		state.mu.Unlock()
	}
}

// deliverLocked sends one room event to a joined socket; state.mu is held.
func (r *Relay) deliverLocked(state *connState, event store.RoomEvent) {
	if event.Entry == nil {
		r.send(state, protocol.MustMarshal(protocol.SessionClosed{Type: "session:closed", Reason: event.CloseReason}))
		state.phase = phaseClosed
		state.conn.Close(1000, "session_closed")
		return
	}
	if event.Entry.Version <= state.delivered {
		return
	}
	state.delivered = event.Entry.Version
	r.send(state, protocol.MustMarshal(protocol.EntryMessage{Type: "entry", Entry: *event.Entry}))
}

func (r *Relay) onPresence(roomID string, event store.PresenceEvent) {
	var message any
	lossy := false
	switch event.Kind {
	case "cursors":
		message = protocol.Cursors{Type: "cursors", Entries: event.Entries}
		lossy = true
	case "peer:joined":
		if event.Participant == nil || event.ParticipantCount == nil {
			return
		}
		message = protocol.PeerJoined{Type: "peer:joined", Participant: *event.Participant, ParticipantCount: *event.ParticipantCount}
	case "peer:left":
		count := 0
		if event.ParticipantCount != nil {
			count = *event.ParticipantCount
		}
		message = protocol.PeerLeft{Type: "peer:left", ClientID: event.ClientID, ParticipantCount: count}
	case "host:status":
		if event.Online == nil {
			return
		}
		message = protocol.HostStatus{Type: "host:status", Online: *event.Online}
	case "lock":
		ttl := protocol.LockTTLMs
		if event.TTLMs != nil {
			ttl = *event.TTLMs
		}
		message = protocol.LockNotice{Type: "lock", EntityID: event.EntityID, Holder: event.Holder, TTLMs: ttl}
	default:
		return
	}
	text := protocol.MustMarshal(message)
	for _, state := range r.roomConns(roomID) {
		phase, _, clientID, _ := state.snapshot()
		if phase != phaseJoined {
			continue
		}
		if event.Kind == "peer:joined" && event.Participant.ClientID == clientID {
			continue
		}
		r.sendText(state, text, lossy)
	}
}

// ── Disconnect ──────────────────────────────────────────────────────────────

func (r *Relay) disconnect(ctx context.Context, state *connState) error {
	r.mu.Lock()
	if !r.conns[state] {
		r.mu.Unlock()
		return nil
	}
	delete(r.conns, state)
	r.mu.Unlock()

	state.mu.Lock()
	wasJoined := state.phase == phaseJoined || state.phase == phaseJoining
	state.phase = phaseClosed
	roomID, clientID := state.roomID, state.clientID
	locks := make([]string, 0, len(state.locks))
	for id := range state.locks {
		locks = append(locks, id)
	}
	state.mu.Unlock()
	if roomID == "" || clientID == "" {
		return nil
	}

	r.mu.Lock()
	if room := r.rooms[roomID]; room != nil {
		delete(room.cursors, clientID)
	}
	r.mu.Unlock()
	r.detach(state)
	if !wasJoined {
		return nil
	}

	// A reconnect may already have replaced this socket; only the last socket of a client removes
	// it from the room.
	r.mu.Lock()
	stillHere := false
	for other := range r.conns {
		other.mu.Lock()
		if other.roomID == roomID && other.clientID == clientID {
			stillHere = true
		}
		other.mu.Unlock()
		if stillHere {
			break
		}
	}
	r.mu.Unlock()
	if stillHere {
		return nil
	}

	ttl := protocol.LockTTLMs
	for _, entityID := range locks {
		released, err := r.store.ReleaseLock(ctx, roomID, entityID, clientID)
		if err != nil {
			return err
		}
		if released {
			if err := r.store.PublishPresence(ctx, roomID, store.PresenceEvent{Kind: "lock", EntityID: entityID, TTLMs: &ttl}); err != nil {
				return err
			}
		}
	}
	count, err := r.store.RemoveMember(ctx, roomID, clientID, state.id, r.opt.Now())
	if err != nil {
		return err
	}
	return r.store.PublishPresence(ctx, roomID, store.PresenceEvent{Kind: "peer:left", ClientID: clientID, ParticipantCount: &count})
}

// ── Timers ──────────────────────────────────────────────────────────────────

func (r *Relay) every(interval time.Duration, task func(ctx context.Context)) {
	r.wg.Add(1)
	go func() {
		defer r.wg.Done()
		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		for {
			select {
			case <-r.stop:
				return
			case <-ticker.C:
				func() {
					defer func() {
						if p := recover(); p != nil {
							r.opt.Log("[collab] timer failed: %v", p)
						}
					}()
					ctx, cancel := context.WithTimeout(context.Background(), r.opt.OperationTimeout)
					defer cancel()
					task(ctx)
				}()
			}
		}
	}()
}

func (r *Relay) logErr(what string, err error) {
	if err != nil {
		r.opt.Log("[collab] %s: %v", what, err)
	}
}

func (r *Relay) renewHostLeases(ctx context.Context) {
	until := r.opt.Now() + r.opt.HostLease.Milliseconds()
	hosted := map[string]bool{}
	r.mu.Lock()
	for s := range r.conns {
		s.mu.Lock()
		if s.role == "host" && s.roomID != "" && s.phase != phaseClosed {
			hosted[s.roomID] = true
		}
		s.mu.Unlock()
	}
	r.mu.Unlock()
	for roomID := range hosted {
		r.logErr("renew host lease", r.store.RenewHostLease(ctx, roomID, until))
	}
}

func (r *Relay) renewMembers(ctx context.Context) {
	until := r.opt.Now() + r.opt.MemberTTL.Milliseconds()
	byRoom := map[string][]string{}
	r.mu.Lock()
	for s := range r.conns {
		s.mu.Lock()
		if s.phase == phaseJoined && s.roomID != "" && s.clientID != "" {
			byRoom[s.roomID] = append(byRoom[s.roomID], s.clientID)
		}
		s.mu.Unlock()
	}
	r.mu.Unlock()
	for roomID, ids := range byRoom {
		r.logErr("renew members", r.store.TouchMembers(ctx, roomID, ids, until))
	}
}

// reap may run on any relay; the store makes each transition happen once.
func (r *Relay) reap(ctx context.Context) {
	now := r.opt.Now()
	expired, err := r.store.ExpiredHostLeases(ctx, now)
	if err != nil {
		r.logErr("reap", err)
		return
	}
	for _, roomID := range expired {
		flipped, err := r.store.MarkHostOffline(ctx, roomID)
		r.logErr("host offline", err)
		if flipped {
			offline := false
			r.logErr("host status", r.store.PublishPresence(ctx, roomID, store.PresenceEvent{Kind: "host:status", Online: &offline}))
		}
	}
	closeBefore := now - (r.opt.HostGrace - r.opt.HostLease).Milliseconds()
	stale, err := r.store.ExpiredHostLeases(ctx, closeBefore)
	if err != nil {
		r.logErr("reap", err)
		return
	}
	for _, roomID := range stale {
		meta, err := r.store.GetMeta(ctx, roomID)
		if err != nil {
			r.logErr("reap", err)
			continue
		}
		if meta != nil && meta.Status == store.StatusSeeding {
			r.logErr("discard", r.store.DiscardRoom(ctx, roomID))
			continue
		}
		closed, err := r.store.CloseRoom(ctx, roomID, protocol.ReasonHostTimeout)
		r.logErr("close", err)
		if closed {
			r.opt.Log("[collab] room closed, host did not return: %s", roomID)
		}
	}
}

// checkRooms drops the sockets of a room that vanished from the store (storage restarted without
// persistence) or was recreated under the same id, so every client reconnects and learns
// `room_unknown`: the host then reseeds and the rest rejoin.
func (r *Relay) checkRooms(ctx context.Context) {
	r.mu.Lock()
	rooms := make(map[string]*localRoom, len(r.rooms))
	for id, room := range r.rooms {
		rooms[id] = room
	}
	r.mu.Unlock()
	for roomID, room := range rooms {
		meta, err := r.store.GetMeta(ctx, roomID)
		if err != nil {
			continue
		}
		if meta != nil && meta.Epoch == room.epoch {
			continue
		}
		r.mu.Lock()
		current := r.rooms[roomID] == room
		r.mu.Unlock()
		if !current {
			continue
		}
		r.dropLocalRoom(roomID, room)
		r.opt.Log("[collab] room lost from storage, clients told to reconnect: %s", roomID)
	}
}

// dropLocalRoom forgets a local subscription and sends its sockets back through a fresh join.
func (r *Relay) dropLocalRoom(roomID string, room *localRoom) {
	r.mu.Lock()
	if r.rooms[roomID] == room {
		delete(r.rooms, roomID)
	}
	states := make([]*connState, 0, len(room.conns))
	for s := range room.conns {
		states = append(states, s)
	}
	r.mu.Unlock()
	room.release()
	// Only joining and joined sockets are attached to a room: a seeding host is not yet.
	for _, s := range states {
		s.conn.Close(4004, "room_lost")
	}
}

func (r *Relay) flushCursors() {
	type batch struct {
		roomID  string
		entries []protocol.CursorEntry
	}
	var batches []batch
	r.mu.Lock()
	for roomID, room := range r.rooms {
		if len(room.cursors) == 0 {
			continue
		}
		entries := make([]protocol.CursorEntry, 0, len(room.cursors))
		for _, e := range room.cursors {
			entries = append(entries, e)
		}
		room.cursors = map[string]protocol.CursorEntry{}
		batches = append(batches, batch{roomID, entries})
	}
	r.mu.Unlock()
	for _, b := range batches {
		ctx, cancel := context.WithTimeout(context.Background(), time.Second)
		r.logErr("cursors", r.store.PublishPresence(ctx, b.roomID, store.PresenceEvent{Kind: "cursors", Entries: b.entries}))
		cancel()
	}
}

// ── Output ──────────────────────────────────────────────────────────────────

func (r *Relay) refuseProtocol(state *connState) {
	r.send(state, session.ProtocolMismatch())
	state.mu.Lock()
	state.phase = phaseClosed
	state.mu.Unlock()
	state.conn.Close(1008, "protocol_mismatch")
}

func (r *Relay) sendError(state *connState, code, message string, limit, size *int) {
	r.send(state, protocol.ErrorFrame(code, message, limit, size))
}

func (r *Relay) send(state *connState, frame []byte) { r.sendText(state, frame, false) }

func (r *Relay) sendText(state *connState, frame []byte, lossy bool) {
	queued := state.conn.Buffered()
	if lossy && queued > r.opt.LossyQueueBytes {
		return
	}
	if queued > r.opt.MaxQueueBytes {
		// Too far behind to catch up live; it reconnects and resumes.
		state.conn.Close(1013, "backpressure")
		return
	}
	state.conn.Send(frame)
}
