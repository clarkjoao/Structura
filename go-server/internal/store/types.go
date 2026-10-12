// Package store is where sessions live. Session handlers talk only to these interfaces, so a
// relay instance — or a Lambda invocation — holds no state it cannot afford to lose.
//
//   - Rooms: the room itself (seed, merge, entries, locks, host status, close). Every store.
//   - Shared: Rooms plus subscriptions, membership with expiry and host leases, for the
//     long-lived relay. Memory and Redis.
//   - Serverless (package serverless): Rooms plus connection records and delivery leases, for
//     Lambda. DynamoDB and Redis.
package store

import (
	"context"
	"errors"
	"time"

	"github.com/clarkjoao/structura/go-server/internal/protocol"
)

// Room statuses.
const (
	StatusSeeding = "seeding"
	StatusOpen    = "open"
	StatusClosed  = "closed"
)

// Apply statuses.
const (
	Applied = "applied"
	Noop    = "noop"
	NotOpen = "not_open"
)

const (
	// EntryLogLimit is how many entries a room keeps for resume. Older resumes get the snapshot.
	EntryLogLimit = 2_000
	// TombstoneLimit bounds remembered removals; the oldest are forgotten first.
	TombstoneLimit = 10_000
	// ClosedRoomTTL is how long a closed room lingers, so late reconnects learn it closed.
	ClosedRoomTTL = 60 * time.Second
)

// ErrUnavailable is returned while the backing storage cannot serve requests.
var ErrUnavailable = errors.New("store: unavailable")

// Meta describes a room.
type Meta struct {
	RoomID        string
	Status        string
	Version       int64
	HostTokenHash string
	HostUser      protocol.User
	SeedChunks    int
	CreatedAt     int64
	// Epoch is fresh for every creation of the room id; see `joined.epoch`.
	Epoch string
}

// CreateInput opens a room in seeding state.
type CreateInput struct {
	RoomID        string
	HostTokenHash string
	HostUser      protocol.User
	SeedChunks    int
	Now           int64
}

// ApplyInput is one patch from one participant.
type ApplyInput struct {
	Patch         protocol.Patch
	SenderVersion int64
	SenderID      string
	OpID          string
}

// ApplyResult is the outcome of a patch.
type ApplyResult struct {
	Status    string
	Version   int64
	Effective protocol.Patch
}

// CommitResult is the outcome of a seed commit; Code is "invalid_seed" or "not_seeding".
type CommitResult struct {
	OK   bool
	Code string
}

// Snapshot is the whole state at one version.
type Snapshot struct {
	Version int64
	State   protocol.State
}

// Rooms is what every store provides.
type Rooms interface {
	Kind() string
	// Available reports whether the store can serve requests right now.
	Available() bool

	// CreateRoom creates a room in seeding state; false when the id is taken.
	CreateRoom(ctx context.Context, in CreateInput) (bool, error)
	// AppendSeedChunk stores one chunk: its JSON string literal exactly as the client sent it.
	AppendSeedChunk(ctx context.Context, roomID string, index int, literal string) error
	// CommitSeed parses the seed, stores it at version 0 and opens the room.
	CommitSeed(ctx context.Context, roomID string) (CommitResult, error)
	// DiscardRoom removes a room that never opened.
	DiscardRoom(ctx context.Context, roomID string) error

	GetMeta(ctx context.Context, roomID string) (*Meta, error)

	ApplyPatch(ctx context.Context, roomID string, in ApplyInput) (ApplyResult, error)
	// ReadSnapshot returns nil when the room is not open.
	ReadSnapshot(ctx context.Context, roomID string) (*Snapshot, error)
	// ReadEntries returns the entries after fromVersion; ok is false when the log no longer
	// covers that span.
	ReadEntries(ctx context.Context, roomID string, fromVersion int64) ([]protocol.Entry, bool, error)

	// AcquireLock acquires or renews: granted when free or already held by clientID.
	AcquireLock(ctx context.Context, roomID, entityID, clientID string, ttl time.Duration) (bool, string, error)
	ReleaseLock(ctx context.Context, roomID, entityID, clientID string) (bool, error)

	// MarkHostOffline flips the host offline once; true only for the call that flipped it.
	MarkHostOffline(ctx context.Context, roomID string) (bool, error)
	MarkHostOnline(ctx context.Context, roomID string) error
	IsHostOnline(ctx context.Context, roomID string) (bool, error)

	// CloseRoom closes once and schedules removal; true only for the call that closed it.
	CloseRoom(ctx context.Context, roomID, reason string) (bool, error)

	Close() error
}

// RoomEvent is an ordered event of one room: an entry, or the close.
type RoomEvent struct {
	Entry       *protocol.Entry
	CloseReason string
}

// PresenceEvent is an ephemeral, lossy message fanned out to every relay with sockets in the
// room. It is encoded exactly as the TypeScript relay encodes it, so both can share a Redis.
type PresenceEvent struct {
	Kind             string                 `json:"kind"`
	Entries          []protocol.CursorEntry `json:"entries,omitempty"`
	Participant      *protocol.Participant  `json:"participant,omitempty"`
	ParticipantCount *int                   `json:"participantCount,omitempty"`
	ClientID         string                 `json:"clientId,omitempty"`
	Online           *bool                  `json:"online,omitempty"`
	EntityID         string                 `json:"entityId,omitempty"`
	Holder           *string                `json:"holder,omitempty"`
	TTLMs            *int                   `json:"ttlMs,omitempty"`
}

// Encode writes the event as JSON, with `holder: null` for lock events.
func (e PresenceEvent) Encode() []byte {
	type plain PresenceEvent
	out := protocol.MustMarshal(plain(e))
	if e.Kind != "lock" || e.Holder != nil {
		return out
	}
	// {"kind":"lock",…} without holder: add it.
	return append(append(out[:len(out)-1:len(out)-1], []byte(`,"holder":null`)...), '}')
}

// MarshalJSON is Encode.
func (e PresenceEvent) MarshalJSON() ([]byte, error) { return e.Encode(), nil }

// Unsubscribe stops a subscription.
type Unsubscribe func()

// AddMemberResult is the outcome of adding a member.
type AddMemberResult struct {
	OK    bool
	Count int
}

// Shared is a store for the long-lived relay.
type Shared interface {
	Rooms

	// AddMember: connID identifies the socket, so a stale socket cannot remove its replacement.
	AddMember(ctx context.Context, roomID string, member protocol.Participant, connID string, expiresAt int64, max int, now int64) (AddMemberResult, error)
	TouchMembers(ctx context.Context, roomID string, clientIDs []string, expiresAt int64) error
	// RemoveMember removes only if connID still owns the membership; returns the remaining count.
	RemoveMember(ctx context.Context, roomID, clientID, connID string, now int64) (int, error)
	ListMembers(ctx context.Context, roomID string, now int64) ([]protocol.Participant, error)

	RenewHostLease(ctx context.Context, roomID string, expiresAt int64) error
	// ExpiredHostLeases lists rooms whose host lease expired before `before`.
	ExpiredHostLeases(ctx context.Context, before int64) ([]string, error)

	// Subscribe delivers every room event after this call, in order. Listeners must not block.
	Subscribe(ctx context.Context, roomID string, listener func(RoomEvent)) (Unsubscribe, error)
	PublishPresence(ctx context.Context, roomID string, event PresenceEvent) error
	SubscribePresence(ctx context.Context, roomID string, listener func(PresenceEvent)) (Unsubscribe, error)
}

// NowMs is the wall clock in milliseconds.
func NowMs() int64 { return time.Now().UnixMilli() }
