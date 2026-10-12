package store

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"sort"
	"sync"
	"time"

	"github.com/clarkjoao/structura/go-server/internal/merge"
	"github.com/clarkjoao/structura/go-server/internal/protocol"
)

// ParseSeed joins seed chunks (JSON string literals) as UTF-16, then parses and validates the
// diagram they spell.
func ParseSeed(literals []string) (protocol.State, bool) {
	var units []uint16
	for _, literal := range literals {
		part, ok := protocol.DecodeJSONStringUTF16([]byte(literal))
		if !ok {
			return protocol.State{}, false
		}
		units = append(units, part...)
	}
	return protocol.ParseState([]byte(protocol.UTF16ToString(units)))
}

// NewEpoch returns a random room incarnation id.
func NewEpoch() string {
	var b [16]byte
	_, _ = rand.Read(b[:])
	h := hex.EncodeToString(b[:])
	return h[0:8] + "-" + h[8:12] + "-" + h[12:16] + "-" + h[16:20] + "-" + h[20:32]
}

type memoryMember struct {
	participant protocol.Participant
	connID      string
	expiresAt   int64
	order       int64
}

type memoryLock struct {
	holder    string
	expiresAt int64
}

type memoryRoom struct {
	meta           Meta
	seed           map[int]string
	target         merge.Target
	log            []protocol.Entry
	tombOrder      []string
	members        map[string]*memoryMember
	memberSeq      int64
	locks          map[string]memoryLock
	hostLeaseUntil int64
	hostOnline     bool
	listeners      map[int]func(RoomEvent)
	presence       map[int]func(PresenceEvent)
}

// Memory is the single-instance store. It is also the executable reference the other stores are
// held to by the contract tests.
type Memory struct {
	mu     sync.Mutex
	rooms  map[string]*memoryRoom
	now    func() int64
	nextID int
	timers []*time.Timer
	closed bool
	// closedTTL is how long a closed room lingers (ClosedRoomTTL).
	closedTTL time.Duration
}

// NewMemory returns an empty in-memory store. now may be nil for the wall clock.
func NewMemory(now func() int64) *Memory {
	if now == nil {
		now = NowMs
	}
	return &Memory{rooms: map[string]*memoryRoom{}, now: now, closedTTL: ClosedRoomTTL}
}

func (m *Memory) Kind() string    { return "memory" }
func (m *Memory) Available() bool { return true }

func (m *Memory) CreateRoom(_ context.Context, in CreateInput) (bool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if _, taken := m.rooms[in.RoomID]; taken {
		return false, nil
	}
	m.rooms[in.RoomID] = &memoryRoom{
		meta: Meta{
			RoomID:        in.RoomID,
			Status:        StatusSeeding,
			HostTokenHash: in.HostTokenHash,
			HostUser:      in.HostUser,
			SeedChunks:    in.SeedChunks,
			CreatedAt:     in.Now,
			Epoch:         NewEpoch(),
		},
		seed:       map[int]string{},
		target:     merge.Target{State: protocol.EmptyState(), Tombstones: map[string]int64{}},
		members:    map[string]*memoryMember{},
		locks:      map[string]memoryLock{},
		hostOnline: true,
		listeners:  map[int]func(RoomEvent){},
		presence:   map[int]func(PresenceEvent){},
	}
	return true, nil
}

func (m *Memory) AppendSeedChunk(_ context.Context, roomID string, index int, literal string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if room := m.rooms[roomID]; room != nil && room.meta.Status == StatusSeeding {
		room.seed[index] = literal
	}
	return nil
}

func (m *Memory) CommitSeed(_ context.Context, roomID string) (CommitResult, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	room := m.rooms[roomID]
	if room == nil || room.meta.Status != StatusSeeding {
		return CommitResult{Code: "not_seeding"}, nil
	}
	literals := make([]string, room.meta.SeedChunks)
	for i := range literals {
		part, ok := room.seed[i]
		if !ok {
			return CommitResult{Code: "invalid_seed"}, nil
		}
		literals[i] = part
	}
	state, ok := ParseSeed(literals)
	if !ok {
		return CommitResult{Code: "invalid_seed"}, nil
	}
	room.target.State = state
	room.seed = map[int]string{}
	room.meta.Status = StatusOpen
	return CommitResult{OK: true}, nil
}

func (m *Memory) DiscardRoom(_ context.Context, roomID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.rooms, roomID)
	return nil
}

func (m *Memory) GetMeta(_ context.Context, roomID string) (*Meta, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	room := m.rooms[roomID]
	if room == nil {
		return nil, nil
	}
	meta := room.meta
	return &meta, nil
}

func (m *Memory) ApplyPatch(_ context.Context, roomID string, in ApplyInput) (ApplyResult, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	room := m.rooms[roomID]
	if room == nil || room.meta.Status != StatusOpen {
		return ApplyResult{Status: NotOpen}, nil
	}
	next := room.meta.Version + 1
	now := m.now()
	effective := merge.Apply(&room.target, in.Patch, next, merge.Context{
		SenderVersion: in.SenderVersion,
		SenderID:      in.SenderID,
		LockHolder: func(entityID string) string {
			if lock, ok := room.locks[entityID]; ok && lock.expiresAt > now {
				return lock.holder
			}
			return ""
		},
	})
	if effective.IsEmpty() {
		return ApplyResult{Status: Noop, Version: room.meta.Version}, nil
	}
	room.meta.Version = next
	entry := protocol.Entry{Version: next, OpID: in.OpID, Sender: in.SenderID, Patch: effective}
	room.log = append(room.log, entry)
	if len(room.log) > EntryLogLimit {
		room.log = append([]protocol.Entry(nil), room.log[len(room.log)-EntryLogLimit:]...)
	}
	m.trimTombstones(room)
	// Emitted under the lock: every listener sees entries in version order.
	for _, listener := range room.listeners {
		listener(RoomEvent{Entry: &entry})
	}
	return ApplyResult{Status: Applied, Version: next, Effective: effective}, nil
}

// trimTombstones forgets the oldest removals past TombstoneLimit.
func (m *Memory) trimTombstones(room *memoryRoom) {
	if len(room.target.Tombstones) <= TombstoneLimit {
		return
	}
	type tomb struct {
		key     string
		version int64
	}
	all := make([]tomb, 0, len(room.target.Tombstones))
	for k, v := range room.target.Tombstones {
		all = append(all, tomb{k, v})
	}
	sort.Slice(all, func(i, j int) bool { return all[i].version < all[j].version })
	for _, t := range all[:len(all)-TombstoneLimit] {
		delete(room.target.Tombstones, t.key)
	}
}

func (m *Memory) ReadSnapshot(_ context.Context, roomID string) (*Snapshot, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	room := m.rooms[roomID]
	if room == nil || room.meta.Status != StatusOpen {
		return nil, nil
	}
	return &Snapshot{Version: room.meta.Version, State: room.target.State.Clone()}, nil
}

func (m *Memory) ReadEntries(_ context.Context, roomID string, from int64) ([]protocol.Entry, bool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	room := m.rooms[roomID]
	if room == nil || room.meta.Status != StatusOpen {
		return nil, false, nil
	}
	version := room.meta.Version
	if from > version {
		return nil, false, nil
	}
	if from == version {
		return []protocol.Entry{}, true, nil
	}
	if len(room.log) == 0 || room.log[0].Version > from+1 {
		return nil, false, nil
	}
	out := make([]protocol.Entry, 0, version-from)
	for _, entry := range room.log {
		if entry.Version > from {
			out = append(out, entry)
		}
	}
	return out, true, nil
}

func (m *Memory) AcquireLock(_ context.Context, roomID, entityID, clientID string, ttl time.Duration) (bool, string, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	room := m.rooms[roomID]
	if room == nil {
		return false, "", nil
	}
	now := m.now()
	if lock, ok := room.locks[entityID]; ok && lock.expiresAt > now && lock.holder != clientID {
		return false, lock.holder, nil
	}
	room.locks[entityID] = memoryLock{holder: clientID, expiresAt: now + ttl.Milliseconds()}
	return true, clientID, nil
}

func (m *Memory) ReleaseLock(_ context.Context, roomID, entityID, clientID string) (bool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	room := m.rooms[roomID]
	if room == nil {
		return false, nil
	}
	lock, ok := room.locks[entityID]
	if !ok || lock.holder != clientID {
		return false, nil
	}
	delete(room.locks, entityID)
	return true, nil
}

func (m *Memory) MarkHostOffline(_ context.Context, roomID string) (bool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	room := m.rooms[roomID]
	if room == nil || !room.hostOnline {
		return false, nil
	}
	room.hostOnline = false
	return true, nil
}

func (m *Memory) MarkHostOnline(_ context.Context, roomID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if room := m.rooms[roomID]; room != nil {
		room.hostOnline = true
	}
	return nil
}

func (m *Memory) IsHostOnline(_ context.Context, roomID string) (bool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	room := m.rooms[roomID]
	return room != nil && room.hostOnline, nil
}

func (m *Memory) CloseRoom(_ context.Context, roomID, reason string) (bool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	room := m.rooms[roomID]
	if room == nil || room.meta.Status == StatusClosed {
		return false, nil
	}
	room.meta.Status = StatusClosed
	for _, listener := range room.listeners {
		listener(RoomEvent{CloseReason: reason})
	}
	if !m.closed {
		timer := time.AfterFunc(m.closedTTL, func() {
			m.mu.Lock()
			defer m.mu.Unlock()
			if m.rooms[roomID] == room {
				delete(m.rooms, roomID)
			}
		})
		m.timers = append(m.timers, timer)
	}
	return true, nil
}

func (m *Memory) Close() error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.closed = true
	for _, t := range m.timers {
		t.Stop()
	}
	m.timers = nil
	m.rooms = map[string]*memoryRoom{}
	return nil
}

// ── Shared ──────────────────────────────────────────────────────────────────

func (m *Memory) pruneMembers(room *memoryRoom, now int64) {
	for id, member := range room.members {
		if member.expiresAt <= now {
			delete(room.members, id)
		}
	}
}

func (m *Memory) AddMember(_ context.Context, roomID string, member protocol.Participant, connID string, expiresAt int64, max int, now int64) (AddMemberResult, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	room := m.rooms[roomID]
	if room == nil {
		return AddMemberResult{}, nil
	}
	m.pruneMembers(room, now)
	existing, present := room.members[member.ClientID]
	if !present && len(room.members) >= max {
		return AddMemberResult{Count: len(room.members)}, nil
	}
	order := room.memberSeq + 1
	if present {
		order = existing.order
	} else {
		room.memberSeq = order
	}
	room.members[member.ClientID] = &memoryMember{participant: member, connID: connID, expiresAt: expiresAt, order: order}
	return AddMemberResult{OK: true, Count: len(room.members)}, nil
}

func (m *Memory) TouchMembers(_ context.Context, roomID string, clientIDs []string, expiresAt int64) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	room := m.rooms[roomID]
	if room == nil {
		return nil
	}
	for _, id := range clientIDs {
		if member := room.members[id]; member != nil {
			member.expiresAt = expiresAt
		}
	}
	return nil
}

func (m *Memory) RemoveMember(_ context.Context, roomID, clientID, connID string, now int64) (int, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	room := m.rooms[roomID]
	if room == nil {
		return 0, nil
	}
	if member := room.members[clientID]; member != nil && member.connID == connID {
		delete(room.members, clientID)
	}
	m.pruneMembers(room, now)
	return len(room.members), nil
}

func (m *Memory) ListMembers(_ context.Context, roomID string, now int64) ([]protocol.Participant, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	room := m.rooms[roomID]
	if room == nil {
		return []protocol.Participant{}, nil
	}
	m.pruneMembers(room, now)
	members := make([]*memoryMember, 0, len(room.members))
	for _, member := range room.members {
		members = append(members, member)
	}
	sort.Slice(members, func(i, j int) bool { return members[i].order < members[j].order })
	out := make([]protocol.Participant, len(members))
	for i, member := range members {
		out[i] = member.participant
	}
	return out, nil
}

func (m *Memory) RenewHostLease(_ context.Context, roomID string, expiresAt int64) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if room := m.rooms[roomID]; room != nil && room.meta.Status != StatusClosed {
		room.hostLeaseUntil = expiresAt
	}
	return nil
}

func (m *Memory) ExpiredHostLeases(_ context.Context, before int64) ([]string, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	var out []string
	for roomID, room := range m.rooms {
		if room.meta.Status != StatusClosed && room.hostLeaseUntil < before {
			out = append(out, roomID)
		}
	}
	sort.Strings(out)
	return out, nil
}

func (m *Memory) Subscribe(_ context.Context, roomID string, listener func(RoomEvent)) (Unsubscribe, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	room := m.rooms[roomID]
	if room == nil {
		return func() {}, nil
	}
	m.nextID++
	id := m.nextID
	room.listeners[id] = listener
	return func() {
		m.mu.Lock()
		defer m.mu.Unlock()
		delete(room.listeners, id)
	}, nil
}

func (m *Memory) PublishPresence(_ context.Context, roomID string, event PresenceEvent) error {
	m.mu.Lock()
	room := m.rooms[roomID]
	var listeners []func(PresenceEvent)
	if room != nil {
		for _, l := range room.presence {
			listeners = append(listeners, l)
		}
	}
	m.mu.Unlock()
	for _, l := range listeners {
		l(event)
	}
	return nil
}

func (m *Memory) SubscribePresence(_ context.Context, roomID string, listener func(PresenceEvent)) (Unsubscribe, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	room := m.rooms[roomID]
	if room == nil {
		return func() {}, nil
	}
	m.nextID++
	id := m.nextID
	room.presence[id] = listener
	return func() {
		m.mu.Lock()
		defer m.mu.Unlock()
		delete(room.presence, id)
	}, nil
}

var _ Shared = (*Memory)(nil)
