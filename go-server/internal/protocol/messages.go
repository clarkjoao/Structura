package protocol

import (
	"encoding/json"
	"math"
	"strconv"
)

// Limits mirror LIMITS in protocol.ts.
const (
	MaxParticipants = 50
	// MaxFrameChars caps any single inbound frame, in UTF-16 code units of its text.
	MaxFrameChars = 256 * 1024
	// ChunkChars is the seed and snapshot chunk size, in UTF-16 code units.
	ChunkChars        = 64 * 1024
	MaxSeedChars      = 8 * 1024 * 1024
	LockTTLMs         = 3_000
	MaxLockBatch      = 500
	MaxLocksPerClient = 1_000
	HostGraceMs       = 30_000
)

// Client message types.
const (
	TypeCreate     = "create"
	TypeSeedChunk  = "seed:chunk"
	TypeSeedCommit = "seed:commit"
	TypeJoin       = "join"
	TypePatch      = "patch"
	TypeLock       = "lock"
	TypeCursor     = "cursor"
	TypeClose      = "close"
	TypePing       = "ping"
	TypePong       = "pong"
)

// ClientMessage is one validated inbound frame. Only the fields of its Type are set.
type ClientMessage struct {
	Type string

	// create, join
	Protocol  float64
	RoomID    string
	User      User
	HostToken *string
	// create
	SeedChars  int
	SeedChunks int
	// seed:chunk — Data is the chunk's JSON string literal exactly as sent (see SeedChunkUnits).
	Index     int
	Data      json.RawMessage
	DataUnits int
	// join
	ResumeFrom  *int64
	ResumeEpoch *string
	// patch
	OpID        string
	BaseVersion int64
	Patch       Patch
	// lock
	Action    string
	EntityIDs []string
	// cursor
	Cursor          *Point
	ActiveElementID *string
}

func integer(raw json.RawMessage) (int64, bool) {
	if raw == nil {
		return 0, false
	}
	var f float64
	if firstByte(raw) == '"' || json.Unmarshal(raw, &f) != nil {
		return 0, false
	}
	if math.IsInf(f, 0) || math.IsNaN(f) || f != math.Trunc(f) {
		return 0, false
	}
	return int64(f), true
}

func number(raw json.RawMessage) (float64, bool) {
	if raw == nil {
		return 0, false
	}
	b := firstByte(raw)
	if b != '-' && (b < '0' || b > '9') {
		return 0, false
	}
	var f float64
	if json.Unmarshal(raw, &f) != nil || math.IsInf(f, 0) || math.IsNaN(f) {
		return 0, false
	}
	return f, true
}

// optionalString accepts an absent field or a string; a present null is invalid.
func optionalString(fields map[string]json.RawMessage, key string) (*string, bool) {
	raw, present := fields[key]
	if !present {
		return nil, true
	}
	s, ok := stringValue(raw)
	if !ok {
		return nil, false
	}
	return &s, true
}

// ParseClientMessage parses and validates one inbound frame; ok is false for anything that is
// not a v3 message.
func ParseClientMessage(raw []byte) (*ClientMessage, bool) {
	fields, ok := object(raw)
	if !ok {
		return nil, false
	}
	msgType, ok := stringValue(fields["type"])
	if !ok {
		return nil, false
	}
	m := &ClientMessage{Type: msgType}
	switch msgType {
	case TypeCreate:
		protocol, okP := number(fields["protocol"])
		roomID, okR := stringValue(fields["roomId"])
		user, okU := ParseUser(fields["user"])
		seedChars, okC := integer(fields["seedChars"])
		seedChunks, okN := integer(fields["seedChunks"])
		hostToken, okT := optionalString(fields, "hostToken")
		if !okP || !okR || !IsRoomID(roomID) || !okU || !okC || !okN || !okT {
			return nil, false
		}
		m.Protocol, m.RoomID, m.User, m.HostToken = protocol, roomID, user, hostToken
		m.SeedChars, m.SeedChunks = clampInt(seedChars), clampInt(seedChunks)
	case TypeSeedChunk:
		index, okI := integer(fields["index"])
		data := fields["data"]
		units, okD := DecodeJSONStringUTF16(data)
		if !okI || !okD {
			return nil, false
		}
		m.Index, m.Data, m.DataUnits = clampInt(index), append(json.RawMessage(nil), data...), len(units)
	case TypeSeedCommit, TypeClose, TypePing, TypePong:
	case TypeJoin:
		protocol, okP := number(fields["protocol"])
		roomID, okR := stringValue(fields["roomId"])
		user, okU := ParseUser(fields["user"])
		hostToken, okT := optionalString(fields, "hostToken")
		resumeEpoch, okE := optionalString(fields, "resumeEpoch")
		if !okP || !okR || !IsRoomID(roomID) || !okU || !okT || !okE {
			return nil, false
		}
		if raw, present := fields["resumeFrom"]; present {
			from, ok := integer(raw)
			if !ok || from < 0 {
				return nil, false
			}
			m.ResumeFrom = &from
		}
		m.Protocol, m.RoomID, m.User, m.HostToken, m.ResumeEpoch = protocol, roomID, user, hostToken, resumeEpoch
	case TypePatch:
		opID, okO := stringValue(fields["opId"])
		base, okB := integer(fields["baseVersion"])
		patch, okPatch := ParsePatch(fields["patch"])
		n := UTF16Len(opID)
		if !okO || n == 0 || n > 128 || !okB || !okPatch {
			return nil, false
		}
		m.OpID, m.BaseVersion, m.Patch = opID, base, patch
	case TypeLock:
		action, _ := stringValue(fields["action"])
		if action != "acquire" && action != "renew" && action != "release" {
			return nil, false
		}
		ids, ok := lockTargets(fields)
		if !ok {
			return nil, false
		}
		m.Action, m.EntityIDs = action, ids
	case TypeCursor:
		cursorRaw, present := fields["cursor"]
		if !present {
			return nil, false
		}
		if !isNull(cursorRaw) {
			point, ok := object(cursorRaw)
			if !ok {
				return nil, false
			}
			x, okX := number(point["x"])
			y, okY := number(point["y"])
			if !okX || !okY {
				return nil, false
			}
			m.Cursor = &Point{X: x, Y: y}
		}
		activeRaw, present := fields["activeElementId"]
		if !present {
			return nil, false
		}
		if !isNull(activeRaw) {
			active, ok := stringValue(activeRaw)
			if !ok {
				return nil, false
			}
			m.ActiveElementID = &active
		}
	default:
		return nil, false
	}
	return m, true
}

func clampInt(v int64) int {
	if v > math.MaxInt32 {
		return math.MaxInt32
	}
	if v < math.MinInt32 {
		return math.MinInt32
	}
	return int(v)
}

// lockTargets reads exactly one of `entityId` or a non-empty, bounded `entityIds`, without repeats.
func lockTargets(fields map[string]json.RawMessage) ([]string, bool) {
	if raw, present := fields["entityId"]; present {
		if _, both := fields["entityIds"]; both {
			return nil, false
		}
		id, ok := stringValue(raw)
		if !ok || !IsSafeKey(id) {
			return nil, false
		}
		return []string{id}, true
	}
	items, ok := arrayItems(fields["entityIds"])
	if !ok || len(items) == 0 || len(items) > MaxLockBatch {
		return nil, false
	}
	seen := make(map[string]bool, len(items))
	out := make([]string, 0, len(items))
	for _, item := range items {
		id, ok := stringValue(item)
		if !ok || !IsSafeKey(id) {
			return nil, false
		}
		if !seen[id] {
			seen[id] = true
			out = append(out, id)
		}
	}
	return out, true
}

// ── Server → client ────────────────────────────────────────────────────────

// ErrorCode values the client understands.
const (
	ErrInvalidMessage   = "invalid_message"
	ErrProtocolMismatch = "protocol_mismatch"
	ErrNotJoined        = "not_joined"
	ErrAlreadyJoined    = "already_joined"
	ErrUnauthorized     = "unauthorized"
	ErrRoomUnknown      = "room_unknown"
	ErrRoomExists       = "room_exists"
	ErrNotReady         = "not_ready"
	ErrRoomFull         = "room_full"
	ErrSessionClosed    = "session_closed"
	ErrTooLarge         = "too_large"
	ErrInvalidSeed      = "invalid_seed"
	ErrRateLimited      = "rate_limited"
	ErrUnavailable      = "unavailable"
)

// Close reasons.
const (
	ReasonHostClosed  = "host_closed"
	ReasonHostTimeout = "host_timeout"
)

// Created answers a create.
type Created struct {
	Type      string `json:"type"`
	RoomID    string `json:"roomId"`
	ClientID  string `json:"clientId"`
	HostToken string `json:"hostToken"`
}

// Joined answers a join (or a seed commit).
type Joined struct {
	Type            string        `json:"type"`
	ClientID        string        `json:"clientId"`
	Role            string        `json:"role"`
	Version         int64         `json:"version"`
	Participants    []Participant `json:"participants"`
	MaxParticipants int           `json:"maxParticipants"`
	HostOnline      bool          `json:"hostOnline"`
	Epoch           string        `json:"epoch"`
	Catchup         *[]Entry      `json:"catchup,omitempty"`
	// DocFields are the doc fields this relay accepts; a client sends nothing outside them.
	DocFields []string `json:"docFields"`
}

// SnapshotChunk is one part of a room's state.
type SnapshotChunk struct {
	Type  string `json:"type"`
	Index int    `json:"index"`
	Total int    `json:"total"`
	Data  string `json:"data"`
}

// SnapshotEnd closes a snapshot transfer.
type SnapshotEnd struct {
	Type    string `json:"type"`
	Version int64  `json:"version"`
}

// EntryMessage carries one entry.
type EntryMessage struct {
	Type string `json:"type"`
	Entry
}

// Ack confirms or refuses a patch.
type Ack struct {
	Type    string `json:"type"`
	OpID    string `json:"opId"`
	Applied bool   `json:"applied"`
	Version int64  `json:"version"`
}

// LockResult answers a lock acquire, or a renew that failed.
type LockResult struct {
	Type     string  `json:"type"`
	EntityID string  `json:"entityId"`
	Granted  bool    `json:"granted"`
	Holder   *string `json:"holder"`
}

// LockNotice tells everyone who holds an entity now.
type LockNotice struct {
	Type     string  `json:"type"`
	EntityID string  `json:"entityId"`
	Holder   *string `json:"holder"`
	TTLMs    int     `json:"ttlMs"`
}

// Cursors carries coalesced cursor positions.
type Cursors struct {
	Type    string        `json:"type"`
	Entries []CursorEntry `json:"entries"`
}

// PeerJoined announces a participant.
type PeerJoined struct {
	Type             string      `json:"type"`
	Participant      Participant `json:"participant"`
	ParticipantCount int         `json:"participantCount"`
}

// PeerLeft announces a departure.
type PeerLeft struct {
	Type             string `json:"type"`
	ClientID         string `json:"clientId"`
	ParticipantCount int    `json:"participantCount"`
}

// HostStatus tells guests whether the host is connected.
type HostStatus struct {
	Type   string `json:"type"`
	Online bool   `json:"online"`
}

// SessionClosed ends the session for everyone.
type SessionClosed struct {
	Type   string `json:"type"`
	Reason string `json:"reason"`
}

// Error reports a refusal.
type Error struct {
	Type    string `json:"type"`
	Code    string `json:"code"`
	Message string `json:"message"`
	Limit   *int   `json:"limit,omitempty"`
	Size    *int   `json:"size,omitempty"`
}

// Simple is a message with only a type (ping, pong).
type Simple struct {
	Type string `json:"type"`
}

// ErrorFrame encodes an error message.
func ErrorFrame(code, message string, limit, size *int) []byte {
	return MustMarshal(Error{Type: "error", Code: code, Message: message, Limit: limit, Size: size})
}

// IntPtr is a helper for optional numbers in messages.
func IntPtr(v int) *int { return &v }

// FormatVersion zero-pads a version for lexical ordering in key-value stores.
func FormatVersion(v int64) string {
	s := strconv.FormatInt(v, 10)
	for len(s) < 12 {
		s = "0" + s
	}
	return s
}
