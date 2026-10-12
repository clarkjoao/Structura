// Package serverless runs protocol v3 without a long-lived process: API Gateway holds the
// sockets, every frame is one Lambda invocation, and replies go out through the `@connections`
// API. Everything a long-lived relay keeps in memory — the socket's phase, its room, what it was
// last sent — lives in a Registry next to the room store.
package serverless

import (
	"context"
	"errors"
	"time"

	"github.com/clarkjoao/structura/go-server/internal/protocol"
)

// Connection phases.
const (
	PhaseNew     = "new"
	PhaseSeeding = "seeding"
	PhaseJoining = "joining"
	PhaseJoined  = "joined"
)

// ConnRecord is one socket's session state.
type ConnRecord struct {
	ConnID     string        `json:"connId"`
	Phase      string        `json:"phase"`
	RoomID     string        `json:"roomId,omitempty"`
	ClientID   string        `json:"clientId,omitempty"`
	Role       string        `json:"role,omitempty"`
	User       protocol.User `json:"user"`
	SeedChunks int           `json:"seedChunks,omitempty"`
	Locks      []string      `json:"locks,omitempty"`
	// Seq is the sequence number of the last patch this socket had applied (see opSeq), or -1.
	Seq int64 `json:"-"`
}

// Member is a socket in a room, with what it has been sent.
type Member struct {
	ConnID      string               `json:"connId"`
	ClientID    string               `json:"clientId"`
	Participant protocol.Participant `json:"participant"`
	Phase       string               `json:"phase"`
	// Epoch is the room incarnation the socket joined.
	Epoch    string `json:"epoch"`
	JoinedAt int64  `json:"joinedAt"`
	// Delivered is the last version this socket was sent (kept apart from the member, in the
	// room's delivery cursor).
	Delivered int64 `json:"-"`
}

// Registry keeps sockets, membership, delivery leases and the set of open rooms.
type Registry interface {
	GetConn(ctx context.Context, connID string) (*ConnRecord, error)
	PutConn(ctx context.Context, rec ConnRecord) error
	DeleteConn(ctx context.Context, connID string) error
	// AdvanceSeq records a socket's applied patch sequence; it only ever moves forward.
	AdvanceSeq(ctx context.Context, connID string, seq int64) error

	PutMember(ctx context.Context, roomID string, m Member) error
	// SetDelivered records what sockets of a room were sent, in one write. Only the delivery
	// lease holder and a joining socket (for itself) write it; a value that goes backwards only
	// makes an entry go out twice, which clients ignore.
	SetDelivered(ctx context.Context, roomID string, delivered map[string]int64) error
	DeleteMember(ctx context.Context, roomID, connID string) error
	ListMembers(ctx context.Context, roomID string) ([]Member, error)

	// AcquireLease takes the room's delivery lease for owner; false while someone else holds it.
	AcquireLease(ctx context.Context, roomID, owner string, ttl time.Duration) (bool, error)
	ReleaseLease(ctx context.Context, roomID, owner string) error

	SetHostOffline(ctx context.Context, roomID string, since int64) error
	ClearHostOffline(ctx context.Context, roomID string) error
	// HostOfflineSince is when the host left, or 0.
	HostOfflineSince(ctx context.Context, roomID string) (int64, error)

	AddRoom(ctx context.Context, roomID string) error
	RemoveRoom(ctx context.Context, roomID string) error
	ListRooms(ctx context.Context) ([]string, error)
}

// ConnTTL bounds how long any record of a socket survives: API Gateway drops every connection
// after 2 hours.
const ConnTTL = 3 * time.Hour

// Errors a Poster reports.
var (
	// ErrGone means the socket no longer exists.
	ErrGone = errors.New("serverless: connection gone")
	// ErrTooLarge means the payload exceeds what API Gateway accepts.
	ErrTooLarge = errors.New("serverless: payload too large")
)

// Poster sends to sockets held by API Gateway.
type Poster interface {
	Post(ctx context.Context, connID string, payload []byte) error
	Disconnect(ctx context.Context, connID string) error
	Alive(ctx context.Context, connID string) (bool, error)
}
