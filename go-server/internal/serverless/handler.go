package serverless

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"log"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/clarkjoao/structura/go-server/internal/protocol"
	"github.com/clarkjoao/structura/go-server/internal/relay"
	"github.com/clarkjoao/structura/go-server/internal/session"
	"github.com/clarkjoao/structura/go-server/internal/store"
)

// Options tune the serverless handlers; zero values take the defaults.
type Options struct {
	MaxParticipants int
	HostGrace       time.Duration
	// LeaseTTL bounds how long a crashed invocation can hold a room's delivery.
	LeaseTTL time.Duration
	// PumpBudget is how long one delivery round runs before the lease is let go and taken again.
	PumpBudget time.Duration
	// HandoverBudget bounds how long an invocation keeps rounds going while work is left and
	// nobody else takes the lease (keep it well under the function timeout).
	HandoverBudget time.Duration
	// MaxPayload is the largest message API Gateway takes (128 KB).
	MaxPayload int
	// ChunkChars is the snapshot chunk size; it must keep a chunk frame under MaxPayload.
	ChunkChars int
	// Batch sends several server messages as one JSON array per post.
	Batch bool
	// SeedWait is how long a seed commit waits for chunks still in flight in other invocations.
	SeedWait time.Duration
	// SeqWait is how long a patch waits for the socket's previous patch, still in another
	// invocation.
	SeqWait time.Duration
	// StaleSeed discards a room still seeding after this long with nobody finishing it.
	StaleSeed  time.Duration
	PatchRate  relay.Rate
	CursorRate relay.Rate
	LockRate   relay.Rate
	Now        func() int64
	Log        func(format string, args ...any)
}

func (o *Options) defaults() {
	if o.MaxParticipants == 0 {
		o.MaxParticipants = protocol.MaxParticipants
	}
	if o.HostGrace == 0 {
		o.HostGrace = protocol.HostGraceMs * time.Millisecond
	}
	if o.LeaseTTL == 0 {
		o.LeaseTTL = 10 * time.Second
	}
	if o.PumpBudget == 0 {
		o.PumpBudget = 4 * time.Second
	}
	if o.HandoverBudget == 0 {
		o.HandoverBudget = 20 * time.Second
	}
	if o.MaxPayload == 0 {
		o.MaxPayload = 126 * 1024
	}
	if o.ChunkChars == 0 {
		o.ChunkChars = 32 * 1024
	}
	if o.SeedWait == 0 {
		o.SeedWait = 5 * time.Second
	}
	if o.SeqWait == 0 {
		o.SeqWait = time.Second
	}
	if o.StaleSeed == 0 {
		o.StaleSeed = 10 * time.Minute
	}
	if o.PatchRate.Rate == 0 {
		o.PatchRate = relay.Rate{Rate: 30, Burst: 60}
	}
	if o.CursorRate.Rate == 0 {
		o.CursorRate = relay.Rate{Rate: 15, Burst: 15}
	}
	if o.LockRate.Rate == 0 {
		o.LockRate = relay.Rate{Rate: 10, Burst: 20}
	}
	if o.Now == nil {
		o.Now = store.NowMs
	}
	if o.Log == nil {
		o.Log = log.Printf
	}
}

// Handler serves API Gateway WebSocket events.
type Handler struct {
	rooms store.Rooms
	reg   Registry
	post  Poster
	opt   Options

	// Rate limits are kept per container: approximate across containers, which is enough to
	// stop a flood without a write per message.
	mu      sync.Mutex
	buckets map[string]*connBuckets
	pruned  time.Time
}

type connBuckets struct {
	patch, cursor, lock *relay.TokenBucket
	seen                time.Time
}

// New builds a handler.
func New(rooms store.Rooms, reg Registry, post Poster, opt Options) *Handler {
	opt.defaults()
	return &Handler{rooms: rooms, reg: reg, post: post, opt: opt, buckets: map[string]*connBuckets{}}
}

func (h *Handler) bucketsFor(connID string) *connBuckets {
	h.mu.Lock()
	defer h.mu.Unlock()
	now := time.Now()
	if now.Sub(h.pruned) > time.Minute {
		for id, b := range h.buckets {
			if now.Sub(b.seen) > 10*time.Minute {
				delete(h.buckets, id)
			}
		}
		h.pruned = now
	}
	b := h.buckets[connID]
	if b == nil {
		b = &connBuckets{
			patch:  relay.NewTokenBucket(h.opt.PatchRate, h.opt.Now),
			cursor: relay.NewTokenBucket(h.opt.CursorRate, h.opt.Now),
			lock:   relay.NewTokenBucket(h.opt.LockRate, h.opt.Now),
		}
		h.buckets[connID] = b
	}
	b.seen = now
	return b
}

// ── Invocation ──────────────────────────────────────────────────────────────

// inv is one invocation: it remembers sockets found gone, and cleans them up at the end.
type inv struct {
	h   *Handler
	ctx context.Context
	id  string

	mu   sync.Mutex
	gone map[string]bool
}

func newOwner() string {
	var b [12]byte
	_, _ = rand.Read(b[:])
	return hex.EncodeToString(b[:])
}

func (h *Handler) begin(ctx context.Context) *inv {
	return &inv{h: h, ctx: ctx, id: newOwner(), gone: map[string]bool{}}
}

func (i *inv) finish() {
	done := map[string]bool{}
	for round := 0; round < 5; round++ {
		i.mu.Lock()
		var pending []string
		for id := range i.gone {
			if !done[id] {
				pending = append(pending, id)
				done[id] = true
			}
		}
		i.mu.Unlock()
		if len(pending) == 0 {
			return
		}
		for _, id := range pending {
			i.logErr("gone socket", i.leave(id))
		}
	}
}

func (i *inv) logErr(what string, err error) {
	if err != nil && !errors.Is(err, context.Canceled) {
		i.h.opt.Log("[collab] %s: %v", what, err)
	}
}

// pack groups frames into posts: one frame alone as itself, several as a JSON array, each post
// under MaxPayload.
func (i *inv) pack(frames [][]byte) [][]byte {
	if !i.h.opt.Batch {
		return frames
	}
	var out [][]byte
	var group [][]byte
	size := 2
	flush := func() {
		switch len(group) {
		case 0:
		case 1:
			out = append(out, group[0])
		default:
			out = append(out, append(append([]byte("["), bytes.Join(group, []byte(","))...), ']'))
		}
		group, size = nil, 2
	}
	for _, f := range frames {
		if len(group) > 0 && size+len(f)+1 > i.h.opt.MaxPayload {
			flush()
		}
		group = append(group, f)
		size += len(f) + 1
	}
	flush()
	return out
}

// send posts frames to one socket, in order.
func (i *inv) send(connID string, frames ...[]byte) error {
	for _, payload := range i.pack(frames) {
		err := i.h.post.Post(i.ctx, connID, payload)
		if errors.Is(err, ErrGone) {
			i.mu.Lock()
			i.gone[connID] = true
			i.mu.Unlock()
			return err
		}
		if err != nil {
			return err
		}
	}
	return nil
}

func (i *inv) sendError(connID, code, message string, limit, size *int) {
	_ = i.send(connID, protocol.ErrorFrame(code, message, limit, size))
}

// closeSocket ends a socket from the server side (API Gateway then reports $disconnect).
func (i *inv) closeSocket(connID string) {
	i.logErr("disconnect", i.h.post.Disconnect(i.ctx, connID))
}

func parallel[T any](items []T, limit int, fn func(T)) {
	var wg sync.WaitGroup
	sem := make(chan struct{}, limit)
	for _, item := range items {
		wg.Add(1)
		sem <- struct{}{}
		go func(item T) {
			defer wg.Done()
			defer func() { <-sem }()
			fn(item)
		}(item)
	}
	wg.Wait()
}

// broadcast sends frames to every joined socket of the room except one.
func (i *inv) broadcast(roomID, except string, frames ...[]byte) {
	members, err := i.h.reg.ListMembers(i.ctx, roomID)
	if err != nil {
		i.logErr("members", err)
		return
	}
	var targets []Member
	for _, m := range members {
		if m.Phase == PhaseJoined && m.ConnID != except {
			targets = append(targets, m)
		}
	}
	parallel(targets, 16, func(m Member) { _ = i.send(m.ConnID, frames...) })
}

// ── Events ──────────────────────────────────────────────────────────────────

// Connect accepts a socket ($connect). Its record from the start means a socket with no record
// is one the store forgot (Redis restarted without persistence), not a new one.
func (h *Handler) Connect(ctx context.Context, connID string) error {
	return h.reg.PutConn(ctx, ConnRecord{ConnID: connID, Phase: PhaseNew, Seq: -1})
}

// Disconnect handles $disconnect.
func (h *Handler) Disconnect(ctx context.Context, connID string) error {
	i := h.begin(ctx)
	defer i.finish()
	return i.leave(connID)
}

// Message handles one frame ($default).
func (h *Handler) Message(ctx context.Context, connID string, body []byte) error {
	i := h.begin(ctx)
	defer i.finish()
	if n := protocol.UTF16LenBytes(body); n > protocol.MaxFrameChars {
		i.sendError(connID, protocol.ErrTooLarge, "Frame too large", protocol.IntPtr(protocol.MaxFrameChars), protocol.IntPtr(n))
		return nil
	}
	m, ok := protocol.ParseClientMessage(body)
	if !ok {
		i.sendError(connID, protocol.ErrInvalidMessage, "Malformed or unknown message", nil, nil)
		return nil
	}
	rec, err := h.reg.GetConn(ctx, connID)
	if err != nil {
		i.logErr("conn", err)
		i.sendError(connID, protocol.ErrUnavailable, "Temporary failure, retry", nil, nil)
		return nil
	}
	if rec == nil {
		if m.Type != protocol.TypeCreate && m.Type != protocol.TypeJoin {
			// The store lost this socket's session: send it back through a fresh join, as a relay
			// does for a room lost from storage. The host then reseeds and the rest rejoin.
			i.closeSocket(connID)
			return nil
		}
		rec = &ConnRecord{ConnID: connID, Phase: PhaseNew, Seq: -1}
	}
	if err := i.handle(rec, m); err != nil {
		i.logErr("handler failed", err)
		i.sendError(connID, protocol.ErrUnavailable, "Temporary failure, retry", nil, nil)
	}
	return nil
}

func (i *inv) handle(rec *ConnRecord, m *protocol.ClientMessage) error {
	switch m.Type {
	case protocol.TypePing:
		_ = i.send(rec.ConnID, protocol.MustMarshal(protocol.Simple{Type: "pong"}))
		if rec.Phase == PhaseJoined {
			return i.maintain(rec.RoomID)
		}
		return nil
	case protocol.TypePong:
		return nil
	case protocol.TypeCreate:
		return i.create(rec, m)
	case protocol.TypeSeedChunk:
		return i.seedChunk(rec, m)
	case protocol.TypeSeedCommit:
		return i.seedCommit(rec)
	case protocol.TypeJoin:
		return i.join(rec, m)
	case protocol.TypePatch:
		return i.patch(rec, m)
	case protocol.TypeLock:
		return i.lock(rec, m)
	case protocol.TypeCursor:
		return i.cursor(rec, m)
	default: // protocol.TypeClose: ParseClientMessage accepts no other type
		return i.closeSession(rec)
	}
}

func (i *inv) refuseProtocol(connID string) {
	_ = i.send(connID, session.ProtocolMismatch())
	i.closeSocket(connID)
}

// ── Create and seed ─────────────────────────────────────────────────────────

func (i *inv) create(rec *ConnRecord, m *protocol.ClientMessage) error {
	if rec.Phase != PhaseNew {
		i.sendError(rec.ConnID, protocol.ErrAlreadyJoined, "Already in a room", nil, nil)
		return nil
	}
	if m.Protocol != protocol.Version {
		i.refuseProtocol(rec.ConnID)
		return nil
	}
	if refusal := session.CheckCreate(m); refusal != nil {
		return i.send(rec.ConnID, refusal)
	}
	hostToken := session.NewHostToken()
	if m.HostToken != nil {
		hostToken = *m.HostToken
	}
	created, err := i.h.rooms.CreateRoom(i.ctx, store.CreateInput{
		RoomID: m.RoomID, HostTokenHash: session.HashToken(hostToken), HostUser: m.User,
		SeedChunks: m.SeedChunks, Now: i.h.opt.Now(),
	})
	if err != nil {
		return err
	}
	if !created {
		i.sendError(rec.ConnID, protocol.ErrRoomExists, "Room already exists", nil, nil)
		return nil
	}
	*rec = ConnRecord{ConnID: rec.ConnID, Phase: PhaseSeeding, RoomID: m.RoomID, ClientID: m.User.ID, Role: "host", User: m.User, SeedChunks: m.SeedChunks, Seq: -1}
	if err := i.h.reg.PutConn(i.ctx, *rec); err != nil {
		return err
	}
	// Indexed from the start, so the reaper can discard a seed nobody finishes.
	if err := i.h.reg.AddRoom(i.ctx, m.RoomID); err != nil {
		return err
	}
	return i.send(rec.ConnID, protocol.MustMarshal(protocol.Created{Type: "created", RoomID: m.RoomID, ClientID: m.User.ID, HostToken: hostToken}))
}

func (i *inv) seedChunk(rec *ConnRecord, m *protocol.ClientMessage) error {
	if rec.Phase != PhaseSeeding || rec.RoomID == "" {
		i.sendError(rec.ConnID, protocol.ErrNotJoined, "No seed in progress", nil, nil)
		return nil
	}
	if m.Index < 0 || m.Index >= rec.SeedChunks || m.DataUnits > protocol.ChunkChars {
		i.sendError(rec.ConnID, protocol.ErrInvalidSeed, "Chunk out of range", nil, nil)
		return nil
	}
	return i.h.rooms.AppendSeedChunk(i.ctx, rec.RoomID, m.Index, string(m.Data))
}

func (i *inv) seedCommit(rec *ConnRecord) error {
	if rec.Phase != PhaseSeeding || rec.RoomID == "" {
		i.sendError(rec.ConnID, protocol.ErrNotJoined, "No seed in progress", nil, nil)
		return nil
	}
	roomID := rec.RoomID
	// The chunks were sent just before the commit, each in its own invocation: some may still
	// be landing.
	deadline := time.Now().Add(i.h.opt.SeedWait)
	var result store.CommitResult
	for {
		var err error
		result, err = i.h.rooms.CommitSeed(i.ctx, roomID)
		if err != nil {
			return err
		}
		if result.OK || result.Code != "invalid_seed" || time.Now().After(deadline) {
			break
		}
		time.Sleep(50 * time.Millisecond)
	}
	if !result.OK {
		if err := i.h.rooms.DiscardRoom(i.ctx, roomID); err != nil {
			return err
		}
		_ = i.h.reg.RemoveRoom(i.ctx, roomID)
		*rec = ConnRecord{ConnID: rec.ConnID, Phase: PhaseNew, Seq: -1}
		if err := i.h.reg.PutConn(i.ctx, *rec); err != nil {
			return err
		}
		i.sendError(rec.ConnID, protocol.ErrInvalidSeed, "The seed could not be read", nil, nil)
		return nil
	}

	meta, err := i.h.rooms.GetMeta(i.ctx, roomID)
	if err != nil || meta == nil {
		return err
	}
	participant := protocol.Participant{ClientID: rec.ClientID, User: rec.User, Role: "host"}
	if err := i.h.reg.PutMember(i.ctx, roomID, Member{
		ConnID: rec.ConnID, ClientID: rec.ClientID, Participant: participant, Phase: PhaseJoined,
		Epoch: meta.Epoch, JoinedAt: i.h.opt.Now(), Delivered: 0,
	}); err != nil {
		return err
	}
	rec.Phase = PhaseJoined
	if err := i.h.reg.PutConn(i.ctx, *rec); err != nil {
		return err
	}
	if err := i.h.rooms.MarkHostOnline(i.ctx, roomID); err != nil {
		return err
	}
	_ = i.h.reg.ClearHostOffline(i.ctx, roomID)
	catchup := []protocol.Entry{}
	i.h.opt.Log("[collab] room opened: %s", roomID)
	return i.send(rec.ConnID, protocol.MustMarshal(protocol.Joined{
		Type: "joined", ClientID: participant.ClientID, Role: "host", Version: 0,
		Participants: []protocol.Participant{participant}, MaxParticipants: i.h.opt.MaxParticipants,
		HostOnline: true, Epoch: meta.Epoch, Catchup: &catchup, DocFields: protocol.DocFields,
	}))
}

// ── Join ────────────────────────────────────────────────────────────────────

// participantsOf lists each client once, in join order.
func participantsOf(members []Member) []protocol.Participant {
	sorted := append([]Member(nil), members...)
	sort.SliceStable(sorted, func(a, b int) bool { return sorted[a].JoinedAt < sorted[b].JoinedAt })
	seen := map[string]bool{}
	out := []protocol.Participant{}
	for _, m := range sorted {
		if seen[m.ClientID] {
			continue
		}
		seen[m.ClientID] = true
		out = append(out, m.Participant)
	}
	return out
}

// snapshotFrames chunks a snapshot so every chunk frame fits one post.
func (i *inv) snapshotFrames(snapshot *store.Snapshot) [][]byte {
	size := i.h.opt.ChunkChars
	for {
		frames := session.SnapshotFrames(snapshot, size)
		fits := true
		for _, f := range frames {
			if len(f) > i.h.opt.MaxPayload {
				fits = false
				break
			}
		}
		if fits || size <= 1024 {
			return frames
		}
		size /= 2
	}
}

func (i *inv) join(rec *ConnRecord, m *protocol.ClientMessage) error {
	if rec.Phase != PhaseNew {
		i.sendError(rec.ConnID, protocol.ErrAlreadyJoined, "Already in a room", nil, nil)
		return nil
	}
	if m.Protocol != protocol.Version {
		i.refuseProtocol(rec.ConnID)
		return nil
	}
	meta, err := i.h.rooms.GetMeta(i.ctx, m.RoomID)
	if err != nil {
		return err
	}
	switch {
	case meta == nil:
		i.sendError(rec.ConnID, protocol.ErrRoomUnknown, "Room unknown", nil, nil)
		return nil
	case meta.Status == store.StatusSeeding:
		i.sendError(rec.ConnID, protocol.ErrNotReady, "Session not ready", nil, nil)
		return nil
	case meta.Status == store.StatusClosed:
		i.sendError(rec.ConnID, protocol.ErrSessionClosed, "Session ended", nil, nil)
		return nil
	}
	role := "guest"
	if m.HostToken != nil {
		if !session.TokenMatches(*m.HostToken, meta.HostTokenHash) {
			i.sendError(rec.ConnID, protocol.ErrUnauthorized, "Invalid host credential", nil, nil)
			return nil
		}
		role = "host"
	}
	roomID := m.RoomID
	members, err := i.h.reg.ListMembers(i.ctx, roomID)
	if err != nil {
		return err
	}
	others := map[string]bool{}
	for _, member := range members {
		if member.ClientID != m.User.ID && member.Epoch == meta.Epoch {
			others[member.ClientID] = true
		}
	}
	if len(others) >= i.h.opt.MaxParticipants {
		i.sendError(rec.ConnID, protocol.ErrRoomFull, "Room is full", protocol.IntPtr(i.h.opt.MaxParticipants), nil)
		i.closeSocket(rec.ConnID)
		return nil
	}

	participant := protocol.Participant{ClientID: m.User.ID, User: m.User, Role: role}
	*rec = ConnRecord{ConnID: rec.ConnID, Phase: PhaseJoining, RoomID: roomID, ClientID: m.User.ID, Role: role, User: m.User, Seq: -1}
	if err := i.h.reg.PutConn(i.ctx, *rec); err != nil {
		return err
	}
	self := Member{ConnID: rec.ConnID, ClientID: m.User.ID, Participant: participant, Phase: PhaseJoining, Epoch: meta.Epoch, JoinedAt: i.h.opt.Now()}
	if err := i.h.reg.PutMember(i.ctx, roomID, self); err != nil {
		return err
	}

	if role == "host" {
		online, err := i.h.rooms.IsHostOnline(i.ctx, roomID)
		if err != nil {
			return err
		}
		if err := i.h.rooms.MarkHostOnline(i.ctx, roomID); err != nil {
			return err
		}
		_ = i.h.reg.ClearHostOffline(i.ctx, roomID)
		if !online {
			i.broadcast(roomID, rec.ConnID, protocol.MustMarshal(protocol.HostStatus{Type: "host:status", Online: true}))
		}
	}

	var current []Member
	for _, member := range members {
		if member.Epoch == meta.Epoch && member.ConnID != rec.ConnID {
			current = append(current, member)
		}
	}
	participants := participantsOf(append(current, self))
	hostOnline, err := i.h.rooms.IsHostOnline(i.ctx, roomID)
	if err != nil {
		return err
	}
	joined := protocol.Joined{
		Type: "joined", ClientID: participant.ClientID, Role: role, Participants: participants,
		MaxParticipants: i.h.opt.MaxParticipants, HostOnline: hostOnline, Epoch: meta.Epoch,
		DocFields: protocol.DocFields,
	}

	var version int64
	resumed := false
	if m.ResumeFrom != nil && m.ResumeEpoch != nil && *m.ResumeEpoch == meta.Epoch {
		catchup, ok, err := i.h.rooms.ReadEntries(i.ctx, roomID, *m.ResumeFrom)
		if err != nil {
			return err
		}
		if ok {
			version = *m.ResumeFrom
			if len(catchup) > 0 {
				version = catchup[len(catchup)-1].Version
			}
			joined.Version, joined.Catchup = version, &catchup
			frame := protocol.MustMarshal(joined)
			// A catch-up too large for one post falls back to the snapshot.
			if len(frame) <= i.h.opt.MaxPayload {
				resumed = true
				if err := i.send(rec.ConnID, frame); err != nil {
					return nil
				}
			}
		}
	}
	if !resumed {
		snapshot, err := i.h.rooms.ReadSnapshot(i.ctx, roomID)
		if err != nil {
			return err
		}
		if snapshot == nil {
			_ = i.h.reg.DeleteMember(i.ctx, roomID, rec.ConnID)
			i.sendError(rec.ConnID, protocol.ErrSessionClosed, "Session ended", nil, nil)
			return nil
		}
		version = snapshot.Version
		joined.Version, joined.Catchup = version, nil
		frames := i.snapshotFrames(snapshot)
		if err := i.send(rec.ConnID, protocol.MustMarshal(joined)); err != nil {
			return nil
		}
		// Chunks carry their index; only `joined` before and `snapshot:end` after are ordered.
		chunks, end := frames[:len(frames)-1], frames[len(frames)-1]
		var failed bool
		var mu sync.Mutex
		parallel(i.pack(chunks), 8, func(payload []byte) {
			if err := i.h.post.Post(i.ctx, rec.ConnID, payload); err != nil {
				mu.Lock()
				failed = true
				mu.Unlock()
			}
		})
		if failed {
			i.closeSocket(rec.ConnID)
			return nil
		}
		if err := i.send(rec.ConnID, end); err != nil {
			return nil
		}
	}

	if err := i.h.reg.SetDelivered(i.ctx, roomID, map[string]int64{rec.ConnID: version}); err != nil {
		return err
	}
	self.Phase, self.Delivered = PhaseJoined, version
	if err := i.h.reg.PutMember(i.ctx, roomID, self); err != nil {
		return err
	}
	rec.Phase = PhaseJoined
	if err := i.h.reg.PutConn(i.ctx, *rec); err != nil {
		return err
	}
	// Whatever landed while the snapshot went out.
	i.pump(roomID)
	count := len(participants)
	i.broadcast(roomID, rec.ConnID, protocol.MustMarshal(protocol.PeerJoined{Type: "peer:joined", Participant: participant, ParticipantCount: count}))
	return nil
}

// ── Edits ───────────────────────────────────────────────────────────────────

// opSeq reads the client's per-socket counter from an op id (`<user>:<time>:<counter>`).
func opSeq(opID string) int64 {
	at := strings.LastIndexByte(opID, ':')
	if at < 0 {
		return -1
	}
	n, err := strconv.ParseInt(opID[at+1:], 10, 64)
	if err != nil || n <= 0 {
		return -1
	}
	return n
}

// sequencer is a store that can take patches through a per-room queue and apply them in
// batches (DynamoDB, where every commit is serialised on the room).
type sequencer interface {
	Enqueue(ctx context.Context, roomID string, p store.QueuedPatch) error
	QueuePending(ctx context.Context, roomID string) (bool, error)
	ApplyQueued(ctx context.Context, roomID string) ([]store.QueuedResult, error)
}

func refusal(opID string) []byte {
	return protocol.MustMarshal(protocol.Ack{Type: "ack", OpID: opID, Applied: false})
}

func (i *inv) patch(rec *ConnRecord, m *protocol.ClientMessage) error {
	if rec.Phase != PhaseJoined || rec.RoomID == "" {
		i.sendError(rec.ConnID, protocol.ErrNotJoined, "Join a room first", nil, nil)
		return nil
	}
	seq := opSeq(m.OpID)
	advanced := false
	advance := func() {
		if seq > 0 && !advanced {
			advanced = true
			i.logErr("seq", i.h.reg.AdvanceSeq(i.ctx, rec.ConnID, seq))
		}
	}
	defer advance()
	// API Gateway may run this socket's next patch before its previous one: wait for it, so a
	// drag ends where the user let go.
	if seq > 0 && rec.Seq >= 0 && seq > rec.Seq+1 {
		deadline := time.Now().Add(i.h.opt.SeqWait)
		for time.Now().Before(deadline) {
			time.Sleep(15 * time.Millisecond)
			latest, err := i.h.reg.GetConn(i.ctx, rec.ConnID)
			if err != nil || latest == nil || latest.Seq >= seq-1 {
				break
			}
		}
	}
	if !i.h.bucketsFor(rec.ConnID).patch.Take() {
		_ = i.send(rec.ConnID, refusal(m.OpID), protocol.ErrorFrame(protocol.ErrRateLimited, "Too many edits", nil, nil))
		return nil
	}
	input := store.ApplyInput{Patch: m.Patch, SenderVersion: m.BaseVersion, SenderID: rec.ClientID, OpID: m.OpID}

	if queue, ok := i.h.rooms.(sequencer); ok {
		if err := queue.Enqueue(i.ctx, rec.RoomID, store.QueuedPatch{ConnID: rec.ConnID, ApplyInput: input}); err != nil {
			i.logErr("enqueue", err)
			_ = i.send(rec.ConnID, refusal(m.OpID))
			return nil
		}
		// In the queue: the next patch of this socket may go. Whoever holds the room's write
		// lease answers it.
		advance()
		i.drain(queue, rec.RoomID)
		return nil
	}

	result, err := i.h.rooms.ApplyPatch(i.ctx, rec.RoomID, input)
	if err != nil {
		// Refused, whether or not it landed: if it did, its entry still arrives and the client
		// takes it as a remote change, so nobody diverges.
		i.logErr("apply", err)
		_ = i.send(rec.ConnID, refusal(m.OpID))
		return nil
	}
	ack := protocol.Ack{Type: "ack", OpID: m.OpID, Applied: result.Status == store.Applied, Version: result.Version}
	_ = i.send(rec.ConnID, protocol.MustMarshal(ack))
	if result.Status == store.Applied {
		i.pump(rec.RoomID)
	}
	return nil
}

// drain applies a room's queued patches in batches, under the room's write lease, and answers
// each sender. An invocation that cannot take the lease leaves its patch to the holder, which
// re-checks the queue after it lets go.
func (i *inv) drain(queue sequencer, roomID string) {
	lease := roomID + "#w"
	deadline := time.Now().Add(i.h.opt.HandoverBudget)
	for time.Now().Before(deadline) {
		got, err := i.h.reg.AcquireLease(i.ctx, lease, i.id, i.h.opt.LeaseTTL)
		if err != nil {
			i.logErr("lease", err)
			return
		}
		if !got {
			return
		}
		deadline := time.Now().Add(i.h.opt.PumpBudget)
		for time.Now().Before(deadline) {
			results, err := queue.ApplyQueued(i.ctx, roomID)
			if err != nil {
				i.logErr("apply queued", err)
				break
			}
			if len(results) == 0 {
				break
			}
			acks := map[string][][]byte{}
			applied := false
			for _, r := range results {
				acks[r.ConnID] = append(acks[r.ConnID], protocol.MustMarshal(protocol.Ack{
					Type: "ack", OpID: r.OpID, Applied: r.Status == store.Applied, Version: r.Version,
				}))
				applied = applied || r.Status == store.Applied
			}
			conns := make([]string, 0, len(acks))
			for connID := range acks {
				conns = append(conns, connID)
			}
			parallel(conns, 16, func(connID string) { _ = i.send(connID, acks[connID]...) })
			if applied {
				i.pump(roomID)
			}
		}
		i.logErr("lease", i.h.reg.ReleaseLease(i.ctx, lease, i.id))
		pending, err := queue.QueuePending(i.ctx, roomID)
		if err != nil || !pending {
			return
		}
	}
}

func (i *inv) lock(rec *ConnRecord, m *protocol.ClientMessage) error {
	if rec.Phase != PhaseJoined || rec.RoomID == "" {
		i.sendError(rec.ConnID, protocol.ErrNotJoined, "Join a room first", nil, nil)
		return nil
	}
	if !i.h.bucketsFor(rec.ConnID).lock.Take() {
		i.sendError(rec.ConnID, protocol.ErrRateLimited, "Too many locks", nil, nil)
		return nil
	}
	ttl := protocol.LockTTLMs
	held := map[string]bool{}
	for _, id := range rec.Locks {
		held[id] = true
	}
	var mu sync.Mutex
	var replies, notices [][]byte
	var firstErr error
	parallel(m.EntityIDs, 16, func(entityID string) {
		if m.Action == "release" {
			released, err := i.h.rooms.ReleaseLock(i.ctx, rec.RoomID, entityID, rec.ClientID)
			mu.Lock()
			defer mu.Unlock()
			delete(held, entityID)
			if err != nil {
				firstErr = err
				return
			}
			if released {
				notices = append(notices, protocol.MustMarshal(protocol.LockNotice{Type: "lock", EntityID: entityID, TTLMs: ttl}))
			}
			return
		}
		mu.Lock()
		allowed := held[entityID] || len(held) < protocol.MaxLocksPerClient
		mu.Unlock()
		granted, holder := false, ""
		if allowed {
			var err error
			granted, holder, err = i.h.rooms.AcquireLock(i.ctx, rec.RoomID, entityID, rec.ClientID, time.Duration(ttl)*time.Millisecond)
			if err != nil {
				mu.Lock()
				firstErr = err
				mu.Unlock()
				return
			}
		}
		mu.Lock()
		defer mu.Unlock()
		if granted {
			held[entityID] = true
		} else {
			delete(held, entityID)
		}
		if m.Action == "acquire" || !granted {
			var h *string
			if holder != "" {
				h = &holder
			}
			replies = append(replies, protocol.MustMarshal(protocol.LockResult{Type: "lock:result", EntityID: entityID, Granted: granted, Holder: h}))
		}
		if granted {
			clientID := rec.ClientID
			notices = append(notices, protocol.MustMarshal(protocol.LockNotice{Type: "lock", EntityID: entityID, Holder: &clientID, TTLMs: ttl}))
		}
	})
	if len(replies) > 0 {
		_ = i.send(rec.ConnID, replies...)
	}
	if len(notices) > 0 {
		i.broadcast(rec.RoomID, "", notices...)
	}
	locks := make([]string, 0, len(held))
	for id := range held {
		locks = append(locks, id)
	}
	sort.Strings(locks)
	if strings.Join(locks, "\x00") != strings.Join(rec.Locks, "\x00") {
		rec.Locks = locks
		if err := i.h.reg.PutConn(i.ctx, *rec); err != nil {
			return err
		}
	}
	return firstErr
}

func (i *inv) cursor(rec *ConnRecord, m *protocol.ClientMessage) error {
	if rec.Phase != PhaseJoined || rec.RoomID == "" {
		return nil
	}
	if !i.h.bucketsFor(rec.ConnID).cursor.Take() {
		return nil
	}
	frame := protocol.MustMarshal(protocol.Cursors{Type: "cursors", Entries: []protocol.CursorEntry{
		{ClientID: rec.ClientID, Cursor: m.Cursor, ActiveElementID: m.ActiveElementID},
	}})
	i.broadcast(rec.RoomID, rec.ConnID, frame)
	return nil
}

func (i *inv) closeSession(rec *ConnRecord) error {
	if rec.Phase != PhaseJoined || rec.Role != "host" || rec.RoomID == "" {
		i.sendError(rec.ConnID, protocol.ErrUnauthorized, "Only the host can end the session", nil, nil)
		return nil
	}
	closed, err := i.h.rooms.CloseRoom(i.ctx, rec.RoomID, protocol.ReasonHostClosed)
	if err != nil || !closed {
		return err
	}
	i.endSession(rec.RoomID, protocol.ReasonHostClosed)
	return nil
}

// ── Leaving ─────────────────────────────────────────────────────────────────

// leave forgets a socket: $disconnect, a socket found gone, or one the server closed.
func (i *inv) leave(connID string) error {
	rec, err := i.h.reg.GetConn(i.ctx, connID)
	if err != nil || rec == nil {
		return err
	}
	if err := i.h.reg.DeleteConn(i.ctx, connID); err != nil {
		return err
	}
	if rec.RoomID == "" {
		return nil
	}
	roomID := rec.RoomID
	if rec.Phase == PhaseSeeding {
		// The reaper discards the half-seeded room once the grace period passes.
		if flipped, err := i.h.rooms.MarkHostOffline(i.ctx, roomID); err == nil && flipped {
			_ = i.h.reg.SetHostOffline(i.ctx, roomID, i.h.opt.Now())
		}
		return nil
	}
	members, err := i.h.reg.ListMembers(i.ctx, roomID)
	if err != nil {
		return err
	}
	if err := i.h.reg.DeleteMember(i.ctx, roomID, connID); err != nil {
		return err
	}
	var others []Member
	sameClient, otherHost := false, false
	for _, m := range members {
		if m.ConnID == connID {
			continue
		}
		others = append(others, m)
		if m.ClientID == rec.ClientID {
			sameClient = true
		}
		if m.Participant.Role == "host" {
			otherHost = true
		}
	}
	// A reconnect may already have replaced this socket.
	if sameClient {
		return nil
	}
	ttl := protocol.LockTTLMs
	var notices [][]byte
	for _, entityID := range rec.Locks {
		released, err := i.h.rooms.ReleaseLock(i.ctx, roomID, entityID, rec.ClientID)
		if err == nil && released {
			notices = append(notices, protocol.MustMarshal(protocol.LockNotice{Type: "lock", EntityID: entityID, TTLMs: ttl}))
		}
	}
	count := len(participantsOf(others))
	notices = append(notices, protocol.MustMarshal(protocol.PeerLeft{Type: "peer:left", ClientID: rec.ClientID, ParticipantCount: count}))
	if rec.Role == "host" && !otherHost {
		flipped, err := i.h.rooms.MarkHostOffline(i.ctx, roomID)
		if err != nil {
			return err
		}
		if flipped {
			_ = i.h.reg.SetHostOffline(i.ctx, roomID, i.h.opt.Now())
			notices = append(notices, protocol.MustMarshal(protocol.HostStatus{Type: "host:status", Online: false}))
		}
	}
	i.broadcast(roomID, connID, notices...)
	return nil
}

// endSession tells every socket the session closed and lets them go.
func (i *inv) endSession(roomID, reason string) {
	members, err := i.h.reg.ListMembers(i.ctx, roomID)
	if err != nil {
		i.logErr("members", err)
		return
	}
	frame := protocol.MustMarshal(protocol.SessionClosed{Type: "session:closed", Reason: reason})
	parallel(members, 16, func(m Member) {
		if m.Phase == PhaseJoined {
			_ = i.send(m.ConnID, frame)
		}
		i.closeSocket(m.ConnID)
		_ = i.h.reg.DeleteConn(i.ctx, m.ConnID)
	})
	i.logErr("remove room", i.h.reg.RemoveRoom(i.ctx, roomID))
}

// roomLost sends every socket of a room the store no longer has back through a fresh join: the
// host reseeds and the rest rejoin.
func (i *inv) roomLost(roomID string) {
	members, _ := i.h.reg.ListMembers(i.ctx, roomID)
	parallel(members, 16, func(m Member) {
		i.closeSocket(m.ConnID)
		_ = i.h.reg.DeleteConn(i.ctx, m.ConnID)
	})
	i.logErr("remove room", i.h.reg.RemoveRoom(i.ctx, roomID))
	i.h.opt.Log("[collab] room lost from storage, clients told to reconnect: %s", roomID)
}

// expireIfAbandoned closes a room whose host has been gone past the grace period.
func (i *inv) expireIfAbandoned(roomID string, meta *store.Meta) (bool, error) {
	since, err := i.h.reg.HostOfflineSince(i.ctx, roomID)
	if err != nil || since == 0 || i.h.opt.Now()-since < i.h.opt.HostGrace.Milliseconds() {
		return false, err
	}
	if meta.Status == store.StatusSeeding {
		if err := i.h.rooms.DiscardRoom(i.ctx, roomID); err != nil {
			return false, err
		}
		return true, i.h.reg.RemoveRoom(i.ctx, roomID)
	}
	closed, err := i.h.rooms.CloseRoom(i.ctx, roomID, protocol.ReasonHostTimeout)
	if err != nil {
		return false, err
	}
	if closed {
		i.h.opt.Log("[collab] room closed, host did not return: %s", roomID)
	}
	i.endSession(roomID, protocol.ReasonHostTimeout)
	return true, nil
}

// maintain is what a ping does for its room: the timers a long-lived relay would run.
func (i *inv) maintain(roomID string) error {
	meta, err := i.h.rooms.GetMeta(i.ctx, roomID)
	if err != nil {
		return err
	}
	if meta == nil {
		i.roomLost(roomID)
		return nil
	}
	if done, err := i.expireIfAbandoned(roomID, meta); done || err != nil {
		return err
	}
	i.drainIfPending(roomID)
	if i.anyBehind(roomID, nil) {
		i.pump(roomID)
	}
	return nil
}

// drainIfPending applies patches a crashed lease holder left in the queue.
func (i *inv) drainIfPending(roomID string) {
	if queue, ok := i.h.rooms.(sequencer); ok {
		if pending, err := queue.QueuePending(i.ctx, roomID); err == nil && pending {
			i.drain(queue, roomID)
		}
	}
}

// Reap runs on a schedule: it closes abandoned rooms, drops sockets API Gateway no longer has
// (a lost $disconnect), and delivers whatever a crashed invocation left behind.
func (h *Handler) Reap(ctx context.Context) error {
	i := h.begin(ctx)
	defer i.finish()
	rooms, err := h.reg.ListRooms(ctx)
	if err != nil {
		return err
	}
	parallel(rooms, 8, func(roomID string) {
		meta, err := h.rooms.GetMeta(ctx, roomID)
		if err != nil {
			i.logErr("reap", err)
			return
		}
		if meta == nil {
			members, _ := h.reg.ListMembers(ctx, roomID)
			if len(members) > 0 {
				i.roomLost(roomID)
			} else {
				i.logErr("remove room", h.reg.RemoveRoom(ctx, roomID))
			}
			return
		}
		if meta.Status == store.StatusClosed {
			i.endSession(roomID, protocol.ReasonHostClosed)
			return
		}
		if done, err := i.expireIfAbandoned(roomID, meta); done || err != nil {
			i.logErr("reap", err)
			return
		}
		if meta.Status == store.StatusSeeding && h.opt.Now()-meta.CreatedAt > h.opt.StaleSeed.Milliseconds() {
			i.logErr("discard", h.rooms.DiscardRoom(ctx, roomID))
			i.logErr("remove room", h.reg.RemoveRoom(ctx, roomID))
			return
		}
		members, err := h.reg.ListMembers(ctx, roomID)
		if err != nil {
			i.logErr("reap", err)
			return
		}
		parallel(members, 16, func(m Member) {
			alive, err := h.post.Alive(ctx, m.ConnID)
			if err == nil && !alive {
				i.logErr("gone socket", i.leave(m.ConnID))
				_ = h.reg.DeleteMember(ctx, roomID, m.ConnID)
			}
		})
		if meta.Status == store.StatusOpen {
			i.drainIfPending(roomID)
			if i.anyBehind(roomID, nil) {
				i.pump(roomID)
			}
		}
	})
	return nil
}

// ── Ordered delivery ────────────────────────────────────────────────────────

// anyBehind reports whether a joined socket of the room has not been sent the latest entry.
func (i *inv) anyBehind(roomID string, skip map[string]bool) bool {
	meta, err := i.h.rooms.GetMeta(i.ctx, roomID)
	if err != nil || meta == nil || meta.Status != store.StatusOpen {
		return false
	}
	members, err := i.h.reg.ListMembers(i.ctx, roomID)
	if err != nil {
		return false
	}
	for _, m := range members {
		if m.Phase == PhaseJoined && m.Epoch == meta.Epoch && m.Delivered < meta.Version && !skip[m.ConnID] {
			return true
		}
	}
	return false
}

// pump delivers the room's entries to every joined socket from its own delivered version, under
// the room's delivery lease, so entries reach each socket once, in order, however invocations
// interleave. An invocation that cannot take the lease leaves: the holder re-checks after it
// lets go, so nothing committed before that is left behind.
func (i *inv) pump(roomID string) {
	failed := map[string]bool{}
	// Never leave while someone is behind and nobody else holds the lease: invocations that
	// failed to take it counted on this one. Past the budget, pings and the reaper pick it up.
	deadline := time.Now().Add(i.h.opt.HandoverBudget)
	for time.Now().Before(deadline) {
		got, err := i.h.reg.AcquireLease(i.ctx, roomID, i.id, i.h.opt.LeaseTTL)
		if err != nil {
			i.logErr("lease", err)
			return
		}
		if !got {
			return
		}
		i.deliver(roomID, failed)
		i.logErr("lease", i.h.reg.ReleaseLease(i.ctx, roomID, i.id))
		if !i.anyBehind(roomID, failed) {
			return
		}
	}
}

func (i *inv) deliver(roomID string, failed map[string]bool) {
	deadline := time.Now().Add(i.h.opt.PumpBudget)
	for time.Now().Before(deadline) {
		meta, err := i.h.rooms.GetMeta(i.ctx, roomID)
		if err != nil || meta == nil || meta.Status != store.StatusOpen {
			return
		}
		members, err := i.h.reg.ListMembers(i.ctx, roomID)
		if err != nil {
			i.logErr("members", err)
			return
		}
		var behind []Member
		from := meta.Version
		for _, m := range members {
			if m.Phase != PhaseJoined || failed[m.ConnID] {
				continue
			}
			if m.Epoch != meta.Epoch {
				// Joined an earlier incarnation of the room: it must rejoin this one.
				failed[m.ConnID] = true
				i.closeSocket(m.ConnID)
				continue
			}
			if m.Delivered < meta.Version {
				behind = append(behind, m)
				from = min(from, m.Delivered)
			}
		}
		if len(behind) == 0 {
			return
		}
		entries, ok, err := i.h.rooms.ReadEntries(i.ctx, roomID, from)
		if err != nil {
			i.logErr("entries", err)
			return
		}
		// Each entry is encoded once for every socket.
		encoded := make(map[int64][]byte, len(entries))
		for _, e := range entries {
			encoded[e.Version] = protocol.MustMarshal(protocol.EntryMessage{Type: "entry", Entry: e})
		}
		var mu sync.Mutex
		sent := map[string]int64{}
		parallel(behind, 16, func(m Member) {
			own := entries
			if !ok {
				mine, covered, err := i.h.rooms.ReadEntries(i.ctx, roomID, m.Delivered)
				own = mine
				if err != nil || !covered {
					// The log no longer covers it: a fresh join gets the snapshot.
					mu.Lock()
					failed[m.ConnID] = true
					mu.Unlock()
					i.closeSocket(m.ConnID)
					return
				}
			}
			var frames [][]byte
			var last int64
			for _, e := range own {
				if e.Version > m.Delivered {
					frame := encoded[e.Version]
					if frame == nil {
						frame = protocol.MustMarshal(protocol.EntryMessage{Type: "entry", Entry: e})
					}
					frames = append(frames, frame)
					last = e.Version
				}
			}
			if len(frames) == 0 {
				return
			}
			err := i.send(m.ConnID, frames...)
			mu.Lock()
			defer mu.Unlock()
			if err == nil {
				sent[m.ConnID] = last
				return
			}
			failed[m.ConnID] = true
			if errors.Is(err, ErrTooLarge) {
				// One entry larger than API Gateway carries: resume through the snapshot.
				i.closeSocket(m.ConnID)
			} else if !errors.Is(err, ErrGone) {
				i.logErr("deliver", err)
			}
		})
		if len(sent) > 0 {
			// One write per round for the whole room.
			i.logErr("delivered", i.h.reg.SetDelivered(i.ctx, roomID, sent))
		}
	}
}
