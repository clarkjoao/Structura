// Package collab is a single-file port of server/src/collab.ts.
//
// It exists to exercise the collaboration protocol under Go's test runner. The
// transport is abstracted behind the Conn interface and time behind Clock, so
// the package has no dependencies outside the standard library and every
// timing rule — cursor coalescing, the idle checksum, the heartbeat — is
// deterministic in a test instead of a sleep.
//
// What is faithful to the TypeScript original:
//
//   - the whole message surface and every error code
//   - room lifecycle, including host reconnect with a 10s grace window
//   - the structural patch merge, tombstones and remove-wins-over-concurrent-edit
//   - the operation log with its count and byte budgets, and replay coverage
//   - snapshot cadence, checksum cadence (count and idle), cursor coalescing
//   - rate limiting, batch and payload caps, protocol-version gating
//   - SnapshotChecksum, byte-for-byte with the client and server twins
//
// What is deliberately not here: the WebSocket handshake and framing. Wire a
// real library to Conn (see PROTOCOL.md); the protocol logic does not care.
//
// Concurrency: Node runs this on one event loop, so every handler here takes
// the hub mutex for its whole duration. That reproduces the original's
// serialisation exactly rather than inventing a finer-grained scheme whose
// races the TypeScript version never had to answer for.
//
//	cd server/go && go test ./...
//
// The protocol itself is specified in docs/collab-websocket-protocol.md.
package collab

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math"
	"sort"
	"strings"
	"sync"
	"time"
	"unicode/utf16"
)

// ---------------------------------------------------------------------------
// Protocol constants — mirror server/src/collab.ts
// ---------------------------------------------------------------------------

const (
	// ProtocolVersion gates joins. v2 made patches sparse and per entity, a
	// change invisible in the message shape: a v1 client would read "these
	// entities changed" as "the collection is now only these" and wipe the
	// user's diagram. Joins that do not declare v2 are refused.
	ProtocolVersion = 2

	MaxParticipants = 15 // 1 host + 14 guests

	MaxOperationLogSize  = 1000
	MaxOperationLogBytes = 2 * 1024 * 1024

	SnapshotIntervalOps = 100
	SnapshotIntervalMS  = 5 * time.Minute

	ChecksumIntervalOps = 25
	ChecksumIdle        = 2000 * time.Millisecond

	MaxPayloadSizeBytes = 100 * 1024
	MaxOpsPerSecond     = 50
	MaxBatchSize        = 10
	RateWindow          = time.Second
	LogThrottle         = time.Second
	MaxBufferedBytes    = 1024 * 1024
	CursorFlush         = 50 * time.Millisecond

	HeartbeatInterval = 30 * time.Second
	HeartbeatTimeout  = 10 * time.Second
	HostReconnectWait = 10 * time.Second
)

// RoleHost and RoleGuest are the two socket roles.
const (
	RoleHost  = "host"
	RoleGuest = "guest"
)

// ---------------------------------------------------------------------------
// Transport and clock seams
// ---------------------------------------------------------------------------

// Conn is one client socket. Implementations must be comparable — use a
// pointer type, since the hub keys socket state by Conn.
type Conn interface {
	// Send queues one already-serialised frame.
	Send(data []byte)
	// Close performs an orderly close with a status code.
	Close(code int, reason string)
	// Terminate drops the socket without a close handshake, for a dead peer.
	Terminate()
	// BufferedAmount is bytes queued and not yet flushed to the network.
	BufferedAmount() int
	// IsOpen reports whether the socket can still take frames.
	IsOpen() bool
}

// Timer is a cancellable one-shot.
type Timer interface{ Stop() }

// Clock supplies now and delayed callbacks, so tests can drive time.
type Clock interface {
	Now() time.Time
	AfterFunc(d time.Duration, f func()) Timer
}

type realClock struct{}

func (realClock) Now() time.Time { return time.Now() }
func (realClock) AfterFunc(d time.Duration, f func()) Timer {
	// time.Timer.Stop reports whether it beat the fire; the seam does not care.
	return stdTimer{time.AfterFunc(d, f)}
}

type stdTimer struct{ t *time.Timer }

func (s stdTimer) Stop() { s.t.Stop() }

// SystemClock is the default Clock, backed by the time package.
var SystemClock Clock = realClock{}

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

// User is the identity a participant announces on join.
type User struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Color string `json:"color"`
}

type guest struct {
	conn Conn
	user User
}

// CursorEntry is one client's newest cursor, awaiting the next coalesced flush.
type CursorEntry struct {
	ClientID        string  `json:"clientId"`
	User            User    `json:"user"`
	Cursor          *Point  `json:"cursor"`
	ActiveElementID *string `json:"activeElementId"`
}

// Point is a cursor position in canvas coordinates.
type Point struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

// Operation is one entry of a room's replay log.
type Operation struct {
	Version     int
	OperationID string
	ClientID    string
	Patch       map[string]any
	Timestamp   time.Time
	Bytes       int
}

// Room is the shared state of one live session.
type Room struct {
	HostConn Conn
	HostUser User
	Snapshot map[string]any

	guests     map[string]*guest
	guestOrder []string // Node's Map preserves insertion order; peers and fan-out follow it

	Version           int // monotonically increasing operation counter
	SnapshotAtVersion int
	ChecksumAtVersion int

	OperationLog      []Operation
	OperationLogBytes int

	// tombstones is collection -> entityID -> version at which it was deleted.
	tombstones map[string]map[string]int

	pendingCursors map[string]CursorEntry
	cursorOrder    []string

	cursorTimer     Timer
	checksumTimer   Timer
	reconnectTimer  Timer
	snapshotTimer   Timer
	snapshotTicking bool
}

type socketState struct {
	RoomID       string
	ClientID     string
	Role         string
	awaitingPong bool
	pongTimeout  Timer
}

type rateBucket struct {
	windowStart time.Time
	count       int
}

type logCounter struct {
	count        int
	lastLoggedAt time.Time
}

// Hub owns every room and socket. The zero value is not usable; call NewHub.
type Hub struct {
	mu sync.Mutex

	clock Clock
	rooms map[string]*Room

	states map[Conn]*socketState

	// Fixed-window counter per room+client. A counter avoids the per-op array
	// allocation a sliding window needed.
	rate map[string]*rateBucket

	logCounters map[string]*logCounter

	heartbeatTimer Timer
	heartbeatOn    bool

	// Logf receives throttled warnings and lifecycle lines. Defaults to a no-op.
	Logf func(format string, args ...any)
	// NewID mints an operation id when the client did not supply one.
	NewID func() string
	// Rand supplies the suffix that de-collides a guest id.
	Rand func() string
}

// NewHub builds a hub. Pass nil for the default system clock.
func NewHub(clock Clock) *Hub {
	if clock == nil {
		clock = SystemClock
	}
	return &Hub{
		clock:       clock,
		rooms:       map[string]*Room{},
		states:      map[Conn]*socketState{},
		rate:        map[string]*rateBucket{},
		logCounters: map[string]*logCounter{},
		Logf:        func(string, ...any) {},
		NewID:       randomHex16,
		Rand:        randomHex4,
	}
}

func randomHex16() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return fmt.Sprintf("op-%d", time.Now().UnixNano())
	}
	return hex.EncodeToString(b)
}

func randomHex4() string {
	b := make([]byte, 2)
	if _, err := rand.Read(b); err != nil {
		return fmt.Sprintf("%d", time.Now().UnixNano()%65536)
	}
	return hex.EncodeToString(b)
}

// Room returns the room by id, for tests and inspection. Nil when absent.
func (h *Hub) Room(roomID string) *Room {
	h.mu.Lock()
	defer h.mu.Unlock()
	return h.rooms[roomID]
}

// GuestIDs lists the room's guests in join order.
func (r *Room) GuestIDs() []string {
	out := make([]string, len(r.guestOrder))
	copy(out, r.guestOrder)
	return out
}

// PeerCount is the host plus every guest.
func (r *Room) PeerCount() int { return 1 + len(r.guests) }

// TombstoneAt reports the version at which an entity was deleted.
func (r *Room) TombstoneAt(collection, entityID string) (int, bool) {
	byEntity, ok := r.tombstones[collection]
	if !ok {
		return 0, false
	}
	v, ok := byEntity[entityID]
	return v, ok
}

// ---------------------------------------------------------------------------
// Checksum — twin of server/src/snapshotChecksum.ts and its client copy
// ---------------------------------------------------------------------------

// syncedKeys is exactly the fields a patch can carry — no more. Hashing
// anything that cannot be synced (ids, level, viewport) would report drift that
// no resync can fix.
var syncedKeys = []string{
	"activeSceneId",
	"compareSceneId",
	"components",
	"connections",
	"description",
	"diagramName",
	"domain",
	"edgeLayouts",
	"flows",
	"iconLibrary",
	"nodeLayouts",
	"scenes",
}

// lessUTF16 orders like JavaScript's `<` on strings, which compares UTF-16 code
// units. Go's byte order disagrees above the BMP: a surrogate pair starts at
// 0xD800 and so sorts below U+E000, while its UTF-8 bytes sort above. Only
// reachable through exotic entity ids, but the fingerprint has to match the
// browser exactly or it reports drift that does not exist.
func lessUTF16(a, b string) bool {
	ua := utf16.Encode([]rune(a))
	ub := utf16.Encode([]rune(b))
	n := len(ua)
	if len(ub) < n {
		n = len(ub)
	}
	for i := 0; i < n; i++ {
		if ua[i] != ub[i] {
			return ua[i] < ub[i]
		}
	}
	return len(ua) < len(ub)
}

// encodeJSONValue mirrors JSON.stringify for a scalar: no HTML escaping, which
// Go's encoding/json applies by default and JavaScript never does.
func encodeJSONValue(v any) string {
	var buf strings.Builder
	enc := json.NewEncoder(&buf)
	enc.SetEscapeHTML(false)
	if err := enc.Encode(v); err != nil {
		return "null"
	}
	return strings.TrimSuffix(buf.String(), "\n")
}

// canonical serialises with sorted keys, so two peers that built the same
// entity in a different order still agree.
func canonical(value any) string {
	switch v := value.(type) {
	case nil:
		return "null"
	case map[string]any:
		keys := make([]string, 0, len(v))
		for k := range v {
			keys = append(keys, k)
		}
		sort.Slice(keys, func(i, j int) bool { return lessUTF16(keys[i], keys[j]) })
		parts := make([]string, 0, len(keys))
		for _, k := range keys {
			parts = append(parts, encodeJSONValue(k)+":"+canonical(v[k]))
		}
		return "{" + strings.Join(parts, ",") + "}"
	case []any:
		parts := make([]string, 0, len(v))
		for _, item := range v {
			parts = append(parts, canonical(item))
		}
		return "[" + strings.Join(parts, ",") + "]"
	default:
		return encodeJSONValue(v)
	}
}

// SnapshotChecksum fingerprints the state a room is supposed to share.
//
// Two FNV-1a passes with different constants, concatenated: 64 bits of hex,
// enough that a collision is not a practical concern for drift detection, and
// cheap enough to run on every checksum frame. The input is walked as UTF-16
// code units because the browser twin uses charCodeAt.
func SnapshotChecksum(snapshot map[string]any) string {
	if snapshot == nil {
		return strings.Repeat("0", 16)
	}

	parts := make([]string, 0, len(syncedKeys))
	for _, key := range syncedKeys {
		parts = append(parts, key+"="+canonical(snapshot[key]))
	}
	text := strings.Join(parts, ";")

	low := uint32(0x811c9dc5)
	high := uint32(0x01000193)
	for _, unit := range utf16.Encode([]rune(text)) {
		low = (low ^ uint32(unit)) * 0x01000193
		high = (high ^ uint32(unit)) * 0x85ebca6b
	}
	return fmt.Sprintf("%08x%08x", low, high)
}

// ---------------------------------------------------------------------------
// Message parsing and validation
// ---------------------------------------------------------------------------

var dangerousKeys = map[string]bool{
	"__proto__":   true,
	"constructor": true,
	"prototype":   true,
}

func asString(v any) (string, bool) {
	s, ok := v.(string)
	return s, ok
}

func asFloat(v any) (float64, bool) {
	f, ok := v.(float64)
	return f, ok
}

func asObject(v any) (map[string]any, bool) {
	m, ok := v.(map[string]any)
	return m, ok
}

func parseUser(value any) (User, bool) {
	m, ok := asObject(value)
	if !ok {
		return User{}, false
	}
	id, okID := asString(m["id"])
	name, okName := asString(m["name"])
	color, okColor := asString(m["color"])
	if !okID || !okName || !okColor {
		return User{}, false
	}
	return User{ID: id, Name: name, Color: color}, true
}

// isValidPatch blocks prototype pollution. Go has no prototype chain, but the
// guard stays: the same frames reach a Node relay, and a patch carrying these
// keys is hostile wherever it lands.
func (h *Hub) isValidPatch(patch map[string]any) bool {
	for key := range patch {
		if dangerousKeys[key] {
			h.Logf("[collab] blocked dangerous patch key: %s", key)
			return false
		}
	}
	return true
}

func (h *Hub) parsePatch(value any) (map[string]any, bool) {
	m, ok := asObject(value)
	if !ok || !h.isValidPatch(m) {
		return nil, false
	}
	return m, true
}

// parseCursor distinguishes three outcomes the way the original does: a
// position, an explicit null (cursor left the canvas), and malformed.
func parseCursor(value any, present bool) (cursor *Point, ok bool) {
	// An absent field is malformed, not "cursor left the canvas" — only an
	// explicit null means that. The original draws the same line.
	if !present {
		return nil, false
	}
	if value == nil {
		return nil, true
	}
	m, isObj := asObject(value)
	if !isObj {
		return nil, false
	}
	x, okX := asFloat(m["x"])
	y, okY := asFloat(m["y"])
	if !okX || !okY {
		return nil, false
	}
	return &Point{X: x, Y: y}, true
}

// parseResumeFrom is the version a rejoining client claims to already hold, or
// -1 when it is starting fresh. Only meaningful if the client vouches that its
// local state matches that version exactly — see the client's resume guard.
func parseResumeFrom(message map[string]any) int {
	v, ok := asFloat(message["resumeFrom"])
	if !ok || v < 0 || v != math.Trunc(v) {
		return -1
	}
	return int(v)
}

// ParseMessage validates frame size before materialising the frame, so the size
// gate costs nothing. Returns the decoded message and its byte length.
func (h *Hub) ParseMessage(raw []byte) (map[string]any, int, bool) {
	size := len(raw)
	if size > MaxPayloadSizeBytes {
		h.logThrottled("payload_too_large", fmt.Sprintf("payload too large: %d bytes", size))
		return nil, size, false
	}
	var parsed any
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return nil, size, false
	}
	m, ok := asObject(parsed)
	if !ok {
		return nil, size, false
	}
	return m, size, true
}

// ---------------------------------------------------------------------------
// Rate limiting and throttled logging
// ---------------------------------------------------------------------------

// rateKeyFor scopes by room so a clientId reused across rooms — the same person
// in two sessions, or a guest-id collision — cannot consume another room's
// budget or have its own cleared by an unrelated disconnect.
func rateKeyFor(roomID, clientID string) string { return roomID + " " + clientID }

func (h *Hub) isRateLimited(rateKey string) bool {
	now := h.clock.Now()
	bucket, ok := h.rate[rateKey]
	if !ok || now.Sub(bucket.windowStart) >= RateWindow {
		bucket = &rateBucket{windowStart: now}
		h.rate[rateKey] = bucket
	}
	if bucket.count >= MaxOpsPerSecond {
		h.logThrottled("rate_limited", "rate limited: key="+rateKey)
		return true
	}
	bucket.count++
	return false
}

// logThrottled collapses repeats into one line per key per interval, carrying
// the suppressed count. Per-message logging is a synchronous write on every
// hot-path event, which is itself a bottleneck under load.
func (h *Hub) logThrottled(key, message string) {
	now := h.clock.Now()
	entry, ok := h.logCounters[key]
	if !ok {
		entry = &logCounter{}
		h.logCounters[key] = entry
	}
	entry.count++
	if now.Sub(entry.lastLoggedAt) < LogThrottle {
		return
	}
	suppressed := entry.count - 1
	entry.lastLoggedAt = now
	entry.count = 0
	if suppressed > 0 {
		h.Logf("[collab] %s (+%d suppressed)", message, suppressed)
		return
	}
	h.Logf("[collab] %s", message)
}

// ---------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------

func safeSend(conn Conn, payload map[string]any) {
	if conn == nil || !conn.IsOpen() {
		return
	}
	data, err := json.Marshal(payload)
	if err != nil {
		return
	}
	conn.Send(data)
}

// sendRawFrame sends an already-serialised frame, so a broadcast marshals once
// for the whole room instead of once per recipient.
//
// Backpressure: a client that cannot drain must not grow the server's heap
// without bound. Cursor traffic is superseded by the next frame anyway, so drop
// it rather than queue it; state-bearing frames are always queued.
func (h *Hub) sendRawFrame(conn Conn, data []byte, lossy bool) {
	if conn == nil || !conn.IsOpen() {
		return
	}
	if lossy && conn.BufferedAmount() > MaxBufferedBytes {
		h.logThrottled("slow_client",
			fmt.Sprintf("dropping lossy frame for slow client (%dB buffered)", conn.BufferedAmount()))
		return
	}
	conn.Send(data)
}

func (h *Hub) sendError(conn Conn, code, message string, closeAfter bool) {
	safeSend(conn, map[string]any{"type": "error", "code": code, "message": message})
	if closeAfter && conn != nil && conn.IsOpen() {
		conn.Close(1008, code)
	}
}

// broadcastToRoom serialises once for the whole room. Doing it per recipient
// meant a 15-seat room paid 14 marshals for one identical frame — with
// whole-collection patches that was the relay's dominant cost.
func (h *Hub) broadcastToRoom(room *Room, payload map[string]any, exceptClientID string, lossy bool) {
	data, err := json.Marshal(payload)
	if err != nil {
		return
	}
	if exceptClientID != room.HostUser.ID && room.HostConn != nil && room.HostConn.IsOpen() {
		h.sendRawFrame(room.HostConn, data, lossy)
	}
	for _, clientID := range room.guestOrder {
		if clientID == exceptClientID {
			continue
		}
		if g, ok := room.guests[clientID]; ok {
			h.sendRawFrame(g.conn, data, lossy)
		}
	}
}

// ---------------------------------------------------------------------------
// Patch application
// ---------------------------------------------------------------------------

// recordTombstone notes that an entity was deleted at the room's current
// version, so a peer that had not yet seen the delete cannot resurrect it.
func (r *Room) recordTombstone(collection, entityID string) {
	byEntity, ok := r.tombstones[collection]
	if !ok {
		byEntity = map[string]int{}
		r.tombstones[collection] = byEntity
	}
	byEntity[entityID] = r.Version
}

// pruneTombstones drops deletes a resync can no longer need. A client behind
// the last snapshot is served the full snapshot rather than a replay, so those
// deletes can never be contradicted by an in-flight patch.
func (r *Room) pruneTombstones() {
	for collection, byEntity := range r.tombstones {
		for entityID, deletedAt := range byEntity {
			if deletedAt <= r.SnapshotAtVersion {
				delete(byEntity, entityID)
			}
		}
		if len(byEntity) == 0 {
			delete(r.tombstones, collection)
		}
	}
}

// applyPatch merges a sparse per-entity patch into the room snapshot and
// returns the portion that actually took effect.
//
// The merge rule is structural rather than a hard-coded list of collection
// names, so adding a collection to the domain needs no change here:
//
//   - an object value is an entity collection: merge one level, and a null
//     entry is a tombstone that removes that entity
//   - anything else is a scalar: assign
//
// The invariant this relies on: every object-valued key at the top level of a
// patch is a keyed collection of entities. Whole-state transfers do not come
// through here — they go via the snapshot path, which replaces outright.
//
// Remove wins over a concurrent edit: a write to an entity deleted at a version
// the sender had not yet seen is dropped, otherwise a peer mid-drag would
// resurrect a node someone else deleted — and, because a delete spans several
// collections while the in-flight edit usually touches one, resurrect it as an
// orphan. A sender that already knew about the delete is deliberately
// re-creating the entity, so its write is honoured and the tombstone cleared.
//
// The caller must broadcast and log the returned patch rather than the one it
// received: peers that applied a suppressed write would diverge from the
// server's own snapshot.
//
// senderKnownVersion is -1 when the sender declared no version.
func (h *Hub) applyPatch(room *Room, patch map[string]any, senderKnownVersion int) map[string]any {
	effective := map[string]any{}

	for _, key := range sortedKeys(patch) {
		value := patch[key]

		collection, isCollection := asObject(value)
		if !isCollection {
			room.Snapshot[key] = value
			effective[key] = value
			continue
		}

		target := map[string]any{}
		if existing, ok := asObject(room.Snapshot[key]); ok {
			for k, v := range existing {
				target[k] = v
			}
		}

		tombstones := room.tombstones[key]
		applied := map[string]any{}
		appliedAny := false

		for _, entityID := range sortedKeys(collection) {
			entityValue := collection[entityID]

			if entityValue == nil {
				delete(target, entityID)
				room.recordTombstone(key, entityID)
				applied[entityID] = nil
				appliedAny = true
				continue
			}

			deletedAt, hasTombstone := tombstones[entityID]
			if hasTombstone && senderKnownVersion >= 0 && senderKnownVersion < deletedAt {
				h.logThrottled("resurrect_blocked",
					fmt.Sprintf("blocked resurrection of %s/%s", key, entityID))
				continue
			}
			if hasTombstone {
				delete(tombstones, entityID)
			}

			target[entityID] = entityValue
			applied[entityID] = entityValue
			appliedAny = true
		}

		if appliedAny {
			room.Snapshot[key] = target
			effective[key] = applied
		}
	}

	return effective
}

// sortedKeys makes iteration deterministic. Go randomises map order and Node
// does not, so without this the same patch could produce different tombstone
// versions across runs.
func sortedKeys(m map[string]any) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	return keys
}

// ---------------------------------------------------------------------------
// Operation log
// ---------------------------------------------------------------------------

// appendOperation adds to the replay log, evicting the oldest entries until it
// is within both the count and byte budgets. Oldest-first eviction keeps the
// most recent history, which is what a resync actually replays.
func appendOperation(room *Room, op Operation) {
	room.OperationLog = append(room.OperationLog, op)
	room.OperationLogBytes += op.Bytes

	for len(room.OperationLog) > MaxOperationLogSize ||
		(room.OperationLogBytes > MaxOperationLogBytes && len(room.OperationLog) > 1) {
		evicted := room.OperationLog[0]
		room.OperationLog = room.OperationLog[1:]
		room.OperationLogBytes -= evicted.Bytes
	}
	if room.OperationLogBytes < 0 {
		room.OperationLogBytes = 0
	}
}

// replayableFrom is the operations needed to bring a client from fromVersion up
// to date, or nil when the log cannot cover that span and a full snapshot is
// required.
//
// The log is trimmed by both count and bytes, so coverage is not guaranteed: it
// holds only ops newer than the last snapshot, and only as many as the budget
// allows. An empty non-nil slice means "already current".
func replayableFrom(room *Room, fromVersion int) []map[string]any {
	if fromVersion < 0 || fromVersion > room.Version {
		return nil
	}
	if fromVersion == room.Version {
		return []map[string]any{}
	}
	if fromVersion < room.SnapshotAtVersion {
		return nil
	}

	ops := make([]Operation, 0, len(room.OperationLog))
	for _, op := range room.OperationLog {
		if op.Version > fromVersion {
			ops = append(ops, op)
		}
	}
	if len(ops) == 0 {
		return nil
	}
	// The oldest op we hold must be the very next one the client needs,
	// otherwise there is a hole in the middle.
	if ops[0].Version != fromVersion+1 {
		return nil
	}

	out := make([]map[string]any, 0, len(ops))
	for _, op := range ops {
		out = append(out, map[string]any{
			"version":     op.Version,
			"operationId": op.OperationID,
			"clientId":    op.ClientID,
			"patch":       op.Patch,
		})
	}
	return out
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

// HandleMessage decodes and routes one inbound frame.
func (h *Hub) HandleMessage(conn Conn, raw []byte) {
	h.mu.Lock()
	defer h.mu.Unlock()

	message, size, ok := h.ParseMessage(raw)
	if !ok {
		h.sendError(conn, "invalid_json", "Invalid JSON message", false)
		return
	}

	messageType, hasType := asString(message["type"])
	if !hasType {
		h.sendError(conn, "missing_type", "Message type is required", false)
		return
	}

	switch messageType {
	case "host:join":
		h.handleHostJoin(conn, message)
	case "host:patch":
		h.handlePatch(conn, message, RoleHost, size)
	case "guest:patch":
		h.handlePatch(conn, message, RoleGuest, size)
	case "host:close":
		h.handleHostClose(conn, message)
	case "guest:join":
		h.handleGuestJoin(conn, message)
	case "peer:cursor":
		h.handlePeerCursor(conn, message)
	case "sync:request":
		h.handleSyncRequest(conn, message)
	case "ping":
		safeSend(conn, map[string]any{"type": "pong"})
	case "pong":
		h.handleHeartbeatPong(conn)
	default:
		h.sendError(conn, "unsupported_message", "Unsupported message type: "+messageType, false)
	}
}

// hasProtocolMismatch rejects a join whose client speaks a different version.
func (h *Hub) hasProtocolMismatch(conn Conn, message map[string]any) bool {
	declared := 1
	if v, ok := asFloat(message["protocol"]); ok {
		declared = int(v)
	}
	if declared == ProtocolVersion {
		return false
	}
	h.sendError(conn, "protocol_mismatch",
		fmt.Sprintf("Unsupported protocol version %d; server speaks %d. Reload to update.",
			declared, ProtocolVersion),
		true)
	return true
}

func (h *Hub) handleHostJoin(conn Conn, message map[string]any) {
	if h.hasProtocolMismatch(conn, message) {
		return
	}

	roomID, hasRoom := asString(message["roomId"])
	diagramID, _ := asString(message["diagramId"])
	user, hasUser := parseUser(message["user"])
	snapshot, hasSnapshot := h.parsePatch(message["snapshot"])

	if !hasRoom || !hasUser || !hasSnapshot {
		h.sendError(conn, "invalid_host_join", "Invalid host:join payload", false)
		return
	}

	if existing, ok := h.rooms[roomID]; ok && existing.HostConn == nil {
		if existing.reconnectTimer != nil {
			existing.reconnectTimer.Stop()
			existing.reconnectTimer = nil
		}

		existing.HostConn = conn
		existing.HostUser = user
		h.states[conn] = &socketState{RoomID: roomID, ClientID: user.ID, Role: RoleHost}

		ack := map[string]any{
			"type":     "host:ack",
			"resumed":  true,
			"protocol": ProtocolVersion,
			"version":  existing.Version,
		}
		if resumeFrom := parseResumeFrom(message); resumeFrom >= 0 {
			if replay := replayableFrom(existing, resumeFrom); replay != nil {
				ack["operations"] = replay
			} else {
				ack["snapshot"] = existing.Snapshot
			}
		} else {
			ack["snapshot"] = existing.Snapshot
		}
		safeSend(conn, ack)

		for _, clientID := range existing.guestOrder {
			g := existing.guests[clientID]
			safeSend(conn, map[string]any{"type": "peer:joined", "clientId": clientID, "user": g.user})
		}
		for _, clientID := range existing.guestOrder {
			safeSend(existing.guests[clientID].conn, map[string]any{"type": "host:reconnected"})
		}

		h.Logf("[collab] host reconnected: room=%s, diagram=%s, host=%s", roomID, orNA(diagramID), user.ID)
		return
	}

	if _, exists := h.rooms[roomID]; exists {
		h.sendError(conn, "room_exists", "Room already exists", true)
		return
	}

	room := &Room{
		HostConn:       conn,
		HostUser:       user,
		Snapshot:       cloneShallow(snapshot),
		guests:         map[string]*guest{},
		tombstones:     map[string]map[string]int{},
		pendingCursors: map[string]CursorEntry{},
	}
	h.rooms[roomID] = room
	h.startSnapshotTimer(roomID)
	h.states[conn] = &socketState{RoomID: roomID, ClientID: user.ID, Role: RoleHost}

	// Carry version and protocol here too: the resumed path already did, and a
	// host with no version cannot declare what it had seen when it patches.
	safeSend(conn, map[string]any{
		"type":     "host:ack",
		"resumed":  false,
		"protocol": ProtocolVersion,
		"version":  room.Version,
	})
	h.Logf("[collab] host joined: room=%s, diagram=%s, host=%s", roomID, orNone(diagramID), user.ID)
}

func (h *Hub) handleGuestJoin(conn Conn, message map[string]any) {
	if h.hasProtocolMismatch(conn, message) {
		return
	}

	roomID, hasRoom := asString(message["roomId"])
	user, hasUser := parseUser(message["user"])
	if !hasRoom || !hasUser {
		h.sendError(conn, "invalid_guest_join", "Invalid guest:join payload", false)
		return
	}

	room, ok := h.rooms[roomID]
	if !ok {
		h.sendError(conn, "room_not_found", "Room not found", false)
		return
	}

	if room.PeerCount() >= MaxParticipants {
		h.sendError(conn, "room_full",
			fmt.Sprintf("Room is full (maximum %d participants)", MaxParticipants), true)
		return
	}

	clientID := h.ensureUniqueGuestID(room, user.ID)
	normalized := User{ID: clientID, Name: user.Name, Color: user.Color}

	room.guests[clientID] = &guest{conn: conn, user: normalized}
	room.guestOrder = append(room.guestOrder, clientID)
	h.states[conn] = &socketState{RoomID: roomID, ClientID: clientID, Role: RoleGuest}

	// A client rejoining after a blip can be caught up with the operations it
	// missed instead of the whole diagram — but only if it still holds the
	// state it claims and the log actually covers the span.
	init := map[string]any{
		"type":     "session:init",
		"protocol": ProtocolVersion,
		// The server may rename a colliding guest id, so tell the client which
		// id it was assigned. Coalesced cursor frames include the recipient's
		// own entry, and this is what it filters on.
		"clientId":         clientID,
		"participantCount": room.PeerCount(),
		"maxParticipants":  MaxParticipants,
		"version":          room.Version,
		"hostUser":         room.HostUser,
		"peers":            buildGuestPeers(room, clientID),
	}
	if resumeFrom := parseResumeFrom(message); resumeFrom >= 0 {
		if replay := replayableFrom(room, resumeFrom); replay != nil {
			init["operations"] = replay
		} else {
			init["snapshot"] = room.Snapshot
		}
	} else {
		init["snapshot"] = room.Snapshot
	}
	safeSend(conn, init)

	h.broadcastToRoom(room, map[string]any{
		"type":             "peer:joined",
		"clientId":         clientID,
		"user":             normalized,
		"participantCount": room.PeerCount(),
		"maxParticipants":  MaxParticipants,
	}, clientID, false)

	h.Logf("[collab] guest joined: room=%s, guest=%s, peers=%d", roomID, clientID, room.PeerCount())
}

func buildGuestPeers(room *Room, joiningClientID string) []map[string]any {
	peers := make([]map[string]any, 0, len(room.guestOrder))
	for _, clientID := range room.guestOrder {
		if clientID == joiningClientID {
			continue
		}
		peers = append(peers, map[string]any{"clientId": clientID, "user": room.guests[clientID].user})
	}
	return peers
}

func (h *Hub) ensureUniqueGuestID(room *Room, desiredID string) string {
	base := strings.TrimSpace(desiredID)
	if base == "" {
		base = "guest-" + h.Rand()
	}
	candidate := base
	for {
		_, taken := room.guests[candidate]
		if candidate != room.HostUser.ID && !taken {
			return candidate
		}
		candidate = base + "-" + h.Rand()
	}
}

// handlePatch serves host:patch and guest:patch, which differ only in who may
// send them and whether the broadcast names the sender.
//
// The version the sender declares is used to decide whether it had seen a
// delete (see applyPatch), not to gate the patch: a connected socket delivers
// every broadcast in order, so a version difference here is concurrency and
// latency, never loss.
func (h *Hub) handlePatch(conn Conn, message map[string]any, role string, frameBytes int) {
	state := h.states[conn]
	roomID, hasRoom := asString(message["roomId"])
	patch, hasPatch := h.parsePatch(message["patch"])

	clientVersion := -1
	if v, ok := asFloat(message["version"]); ok {
		clientVersion = int(v)
	}

	invalidCode := "invalid_host_patch"
	if role == RoleGuest {
		invalidCode = "invalid_guest_patch"
	}

	if state == nil || !hasRoom || !hasPatch || state.RoomID != roomID {
		h.sendError(conn, invalidCode, "Invalid "+role+":patch payload", false)
		return
	}
	// Only guest:patch checks the sender's role, matching the original.
	if role == RoleGuest && state.Role != RoleGuest {
		h.sendError(conn, invalidCode, "Invalid guest:patch payload", false)
		return
	}

	room, ok := h.rooms[roomID]
	if !ok || (role == RoleHost && room.HostConn == nil) {
		h.sendError(conn, "room_not_found", "Room not found", false)
		return
	}

	if h.isRateLimited(rateKeyFor(roomID, state.ClientID)) {
		h.sendError(conn, "rate_limited", "Too many operations per second", false)
		return
	}

	if batched, ok := asFloat(message["batched"]); ok && int(batched) > MaxBatchSize {
		h.sendError(conn, "batch_too_large",
			fmt.Sprintf("Batch size exceeds maximum of %d", MaxBatchSize), false)
		return
	}

	operationID, hasOpID := asString(message["operationId"])
	if !hasOpID {
		operationID = h.NewID()
	}

	// What actually landed may be narrower than what was sent — see applyPatch
	// on remove-wins.
	room.Version++
	effective := h.applyPatch(room, patch, clientVersion)

	appendOperation(room, Operation{
		Version:     room.Version,
		OperationID: operationID,
		ClientID:    state.ClientID,
		Patch:       effective,
		Timestamp:   h.clock.Now(),
		Bytes:       frameBytes,
	})

	h.checkAndTakePeriodicSnapshot(room, roomID)

	safeSend(conn, map[string]any{
		"type":        "OP_ACK",
		"operationId": operationID,
		"version":     room.Version,
		"accepted":    true,
	})

	// Broadcast what landed, not what was sent: a peer applying a suppressed
	// write would drift from the server's snapshot.
	//
	// The sender is included. Excluding it left a hole in the only ordered view
	// it has of the room: with its own operations missing, a peer's older patch
	// that arrived afterwards became its final state while the server had moved
	// on, and nothing ever reconciled the two.
	if len(effective) > 0 {
		frame := map[string]any{
			"type":        "session:patch",
			"patch":       effective,
			"operationId": operationID,
			"version":     room.Version,
		}
		if role == RoleGuest {
			frame["clientId"] = state.ClientID
		}
		h.broadcastToRoom(room, frame, "", false)
	}

	// After the patch, never before: a client that has not applied this version
	// yet would read its own lag as divergence and ask for a needless repair.
	h.broadcastChecksum(room)
}

func (h *Hub) handleHostClose(conn Conn, message map[string]any) {
	state := h.states[conn]
	roomID, hasRoom := asString(message["roomId"])

	if state == nil || state.Role != RoleHost || !hasRoom || state.RoomID != roomID {
		h.sendError(conn, "invalid_host_close", "Invalid host:close payload", false)
		return
	}
	h.closeRoom(roomID, "session:closed")
}

func (h *Hub) handlePeerCursor(conn Conn, message map[string]any) {
	state := h.states[conn]
	roomID, hasRoom := asString(message["roomId"])

	cursorValue, cursorPresent := message["cursor"]
	cursor, cursorOK := parseCursor(cursorValue, cursorPresent)

	var activeElementID *string
	if s, ok := asString(message["activeElementId"]); ok {
		activeElementID = &s
	}

	if state == nil || !hasRoom || state.RoomID != roomID || !cursorOK {
		h.sendError(conn, "invalid_peer_cursor", "Invalid peer:cursor payload", false)
		return
	}

	room, ok := h.rooms[roomID]
	if !ok {
		h.sendError(conn, "room_not_found", "Room not found", false)
		return
	}

	var user User
	if state.Role == RoleHost {
		user = room.HostUser
	} else {
		g, ok := room.guests[state.ClientID]
		if !ok {
			return
		}
		user = g.user
	}

	// Coalesce rather than relay. Relaying each cursor immediately cost one
	// send per peer per event: a full room at 30Hz was 6,300 sends/s from one
	// room alone. Keeping only the newest position per client and flushing the
	// room once per tick makes that 15 sends per tick regardless of how fast
	// anyone moves, which is what lets 50 rooms share one event loop.
	if _, seen := room.pendingCursors[state.ClientID]; !seen {
		room.cursorOrder = append(room.cursorOrder, state.ClientID)
	}
	room.pendingCursors[state.ClientID] = CursorEntry{
		ClientID:        state.ClientID,
		User:            user,
		Cursor:          cursor,
		ActiveElementID: activeElementID,
	}
	h.scheduleCursorFlush(room, roomID)
}

func (h *Hub) scheduleCursorFlush(room *Room, roomID string) {
	if room.cursorTimer != nil {
		return
	}
	room.cursorTimer = h.clock.AfterFunc(CursorFlush, func() {
		h.mu.Lock()
		defer h.mu.Unlock()
		h.flushCursors(room, roomID)
	})
}

// flushCursors sends the room's coalesced positions as a single frame.
//
// The frame carries every pending cursor, including the recipient's own, so the
// room pays one marshal instead of one per recipient. Clients drop their own
// entry by clientId.
func (h *Hub) flushCursors(room *Room, roomID string) {
	room.cursorTimer = nil
	if len(room.pendingCursors) == 0 {
		return
	}
	cursors := make([]CursorEntry, 0, len(room.pendingCursors))
	for _, clientID := range room.cursorOrder {
		if entry, ok := room.pendingCursors[clientID]; ok {
			cursors = append(cursors, entry)
		}
	}
	room.pendingCursors = map[string]CursorEntry{}
	room.cursorOrder = nil

	h.broadcastToRoom(room, map[string]any{
		"type":    "peer:cursors",
		"roomId":  roomID,
		"cursors": cursors,
	}, "", true)
}

func (h *Hub) handleSyncRequest(conn Conn, message map[string]any) {
	state := h.states[conn]
	roomID, hasRoom := asString(message["roomId"])

	baseVersion := 0
	if v, ok := asFloat(message["baseVersion"]); ok {
		baseVersion = int(v)
	}

	if state == nil || !hasRoom || state.RoomID != roomID {
		h.sendError(conn, "invalid_sync_request", "Invalid sync:request payload", false)
		return
	}

	room, ok := h.rooms[roomID]
	if !ok {
		h.sendError(conn, "room_not_found", "Room not found", false)
		return
	}

	// A checksum mismatch means the content is wrong, not that operations are
	// missing — the client is usually at the right version. Replaying the log
	// would send it nothing, so this case always gets the full snapshot.
	reason, _ := asString(message["reason"])
	wantsFullResync := reason == "checksum"

	if wantsFullResync || baseVersion < room.SnapshotAtVersion {
		safeSend(conn, map[string]any{
			"type":            "SYNC_SNAPSHOT",
			"version":         room.Version,
			"snapshot":        room.Snapshot,
			"snapshotVersion": room.SnapshotAtVersion,
		})
		return
	}

	operations := make([]map[string]any, 0)
	for _, op := range room.OperationLog {
		if op.Version > baseVersion {
			operations = append(operations, map[string]any{
				"version":     op.Version,
				"operationId": op.OperationID,
				"patch":       op.Patch,
				"clientId":    op.ClientID,
			})
		}
	}

	safeSend(conn, map[string]any{
		"type":       "SYNC_COMPLETE",
		"version":    room.Version,
		"operations": operations,
	})
}

func (h *Hub) handleHeartbeatPong(conn Conn) {
	state := h.states[conn]
	if state == nil {
		return
	}
	state.awaitingPong = false
	clearSocketHeartbeat(state)
}

// ---------------------------------------------------------------------------
// Snapshots and checksums
// ---------------------------------------------------------------------------

func (h *Hub) checkAndTakePeriodicSnapshot(room *Room, roomID string) {
	if room.Version-room.SnapshotAtVersion >= SnapshotIntervalOps {
		h.takePeriodicSnapshot(room, roomID)
	}
}

// takePeriodicSnapshot broadcasts the snapshot, trims the operation log and
// moves the snapshot marker.
func (h *Hub) takePeriodicSnapshot(room *Room, roomID string) {
	snapshotVersion := room.Version

	h.broadcastToRoom(room, map[string]any{
		"type":     "PERIODIC_SNAPSHOT",
		"version":  snapshotVersion,
		"snapshot": cloneShallow(room.Snapshot),
	}, "", false)

	// Capture the old marker BEFORE updating so the filter keeps the right ops.
	previous := room.SnapshotAtVersion
	room.SnapshotAtVersion = snapshotVersion

	kept := room.OperationLog[:0:0]
	bytes := 0
	for _, op := range room.OperationLog {
		if op.Version > previous {
			kept = append(kept, op)
			bytes += op.Bytes
		}
	}
	room.OperationLog = kept
	room.OperationLogBytes = bytes

	// Deletes older than the snapshot can no longer be contradicted: anyone
	// that far behind is served the snapshot itself.
	room.pruneTombstones()

	h.Logf("[collab] periodic snapshot: room=%s, version=%d, opsLogged=%d",
		roomID, snapshotVersion, len(room.OperationLog))
}

// publishChecksum broadcasts a fingerprint so clients can tell whether they
// still agree with the room.
//
// Versions alone cannot answer that: a client can be at the right version and
// still hold a stale entity, which is exactly how divergence went unnoticed.
// The frame is ~16 bytes of hash, so it can run far more often than the full
// snapshot it may end up triggering.
func (h *Hub) publishChecksum(room *Room) {
	if room.Version == room.ChecksumAtVersion {
		return
	}
	room.ChecksumAtVersion = room.Version
	h.broadcastToRoom(room, map[string]any{
		"type":     "sync:checksum",
		"version":  room.Version,
		"checksum": SnapshotChecksum(room.Snapshot),
	}, "", false)
}

// broadcastChecksum arms the idle publish and fires the count-based one.
//
// Publishing only every N operations leaves the last window of a burst
// unverified: the room goes quiet, no further fingerprint is sent, and a client
// that drifted on one of those final operations stays wrong with nobody
// looking. So the count triggers one, and so does falling idle.
func (h *Hub) broadcastChecksum(room *Room) {
	if room.checksumTimer != nil {
		room.checksumTimer.Stop()
	}
	room.checksumTimer = h.clock.AfterFunc(ChecksumIdle, func() {
		h.mu.Lock()
		defer h.mu.Unlock()
		room.checksumTimer = nil
		h.publishChecksum(room)
	})

	if room.Version-room.ChecksumAtVersion >= ChecksumIntervalOps {
		h.publishChecksum(room)
	}
}

func (h *Hub) startSnapshotTimer(roomID string) {
	room := h.rooms[roomID]
	if room == nil || room.snapshotTicking {
		return
	}
	room.snapshotTicking = true

	var tick func()
	tick = func() {
		h.mu.Lock()
		defer h.mu.Unlock()
		current := h.rooms[roomID]
		if current == nil || current.HostConn == nil {
			// Room is closed or the host disconnected: stop the timer.
			if current != nil {
				current.snapshotTicking = false
				current.snapshotTimer = nil
			}
			return
		}
		if current.Version-current.SnapshotAtVersion > 0 {
			h.takePeriodicSnapshot(current, roomID)
		}
		current.snapshotTimer = h.clock.AfterFunc(SnapshotIntervalMS, tick)
	}
	room.snapshotTimer = h.clock.AfterFunc(SnapshotIntervalMS, tick)
	h.Logf("[collab] snapshot timer started: room=%s, interval=%s", roomID, SnapshotIntervalMS)
}

func (h *Hub) stopSnapshotTimer(room *Room, roomID string) {
	if room.snapshotTimer != nil {
		room.snapshotTimer.Stop()
		room.snapshotTimer = nil
	}
	if room.snapshotTicking {
		room.snapshotTicking = false
		h.Logf("[collab] snapshot timer stopped: room=%s", roomID)
	}
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

func clearSocketHeartbeat(state *socketState) {
	if state.pongTimeout == nil {
		return
	}
	state.pongTimeout.Stop()
	state.pongTimeout = nil
	state.awaitingPong = false
}

func (h *Hub) closeRoom(roomID, reason string) {
	room, ok := h.rooms[roomID]
	if !ok {
		return
	}

	if room.reconnectTimer != nil {
		room.reconnectTimer.Stop()
		room.reconnectTimer = nil
	}

	delete(h.rooms, roomID)

	msgType := "host:disconnected"
	if reason == "session:closed" {
		msgType = "session:closed"
	}
	for _, clientID := range room.guestOrder {
		if g, ok := room.guests[clientID]; ok {
			safeSend(g.conn, map[string]any{"type": msgType})
		}
	}

	for _, clientID := range room.guestOrder {
		g, ok := room.guests[clientID]
		if !ok {
			continue
		}
		if state, ok := h.states[g.conn]; ok {
			clearSocketHeartbeat(state)
			delete(h.states, g.conn)
		}
		if g.conn.IsOpen() {
			g.conn.Close(1000, "room_closed")
		}
		h.Logf("[collab] guest disconnected: room=%s", clientID)
	}

	if room.HostConn != nil {
		if state, ok := h.states[room.HostConn]; ok {
			clearSocketHeartbeat(state)
			delete(h.states, room.HostConn)
		}
	}

	h.stopSnapshotTimer(room, roomID)

	if room.cursorTimer != nil {
		room.cursorTimer.Stop()
		room.cursorTimer = nil
	}
	if room.checksumTimer != nil {
		room.checksumTimer.Stop()
		room.checksumTimer = nil
	}
	room.pendingCursors = map[string]CursorEntry{}
	room.cursorOrder = nil

	h.Logf("[collab] room closed: room=%s, reason=%s", roomID, reason)
}

// HandleClose reacts to a socket going away.
func (h *Hub) HandleClose(conn Conn) {
	h.mu.Lock()
	defer h.mu.Unlock()

	state, ok := h.states[conn]
	if !ok {
		return
	}

	clearSocketHeartbeat(state)
	delete(h.rate, rateKeyFor(state.RoomID, state.ClientID))
	delete(h.states, conn)

	room, ok := h.rooms[state.RoomID]
	if !ok {
		return
	}

	if state.Role == RoleHost {
		for _, clientID := range room.guestOrder {
			if g, ok := room.guests[clientID]; ok {
				safeSend(g.conn, map[string]any{"type": "host:reconnecting"})
			}
		}
		roomID := state.RoomID
		room.reconnectTimer = h.clock.AfterFunc(HostReconnectWait, func() {
			h.mu.Lock()
			defer h.mu.Unlock()
			if current, ok := h.rooms[roomID]; ok {
				current.reconnectTimer = nil
			}
			h.Logf("[collab] host reconnect timeout: room=%s", roomID)
			h.closeRoom(roomID, "host:disconnected")
		})
		room.HostConn = nil
		return
	}

	if _, present := room.guests[state.ClientID]; !present {
		return
	}
	delete(room.guests, state.ClientID)
	room.guestOrder = removeString(room.guestOrder, state.ClientID)
	delete(room.pendingCursors, state.ClientID)
	room.cursorOrder = removeString(room.cursorOrder, state.ClientID)

	h.broadcastToRoom(room, map[string]any{
		"type":             "peer:left",
		"clientId":         state.ClientID,
		"participantCount": room.PeerCount(),
		"maxParticipants":  MaxParticipants,
	}, "", false)

	h.Logf("[collab] guest left: room=%s, guest=%s", state.RoomID, state.ClientID)
}

// StartHeartbeat begins pinging every socket and terminating those that do not
// answer within HeartbeatTimeout.
func (h *Hub) StartHeartbeat() {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.heartbeatOn {
		return
	}
	h.heartbeatOn = true

	var tick func()
	tick = func() {
		h.mu.Lock()
		defer h.mu.Unlock()
		if !h.heartbeatOn {
			return
		}
		h.pingAllLocked()
		h.heartbeatTimer = h.clock.AfterFunc(HeartbeatInterval, tick)
	}
	h.heartbeatTimer = h.clock.AfterFunc(HeartbeatInterval, tick)
}

// StopHeartbeat cancels the ping loop.
func (h *Hub) StopHeartbeat() {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.heartbeatOn = false
	if h.heartbeatTimer != nil {
		h.heartbeatTimer.Stop()
		h.heartbeatTimer = nil
	}
}

func (h *Hub) pingAllLocked() {
	for conn, state := range h.states {
		if !conn.IsOpen() {
			continue
		}
		clearSocketHeartbeat(state)
		state.awaitingPong = true
		safeSend(conn, map[string]any{"type": "ping"})

		conn, state := conn, state
		state.pongTimeout = h.clock.AfterFunc(HeartbeatTimeout, func() {
			h.mu.Lock()
			defer h.mu.Unlock()
			if !state.awaitingPong {
				return
			}
			h.Logf("[collab] heartbeat timeout: room=%s, client=%s", state.RoomID, state.ClientID)
			conn.Terminate()
		})
	}
}

// Shutdown closes every room and stops every timer.
func (h *Hub) Shutdown() {
	h.StopHeartbeat()
	h.mu.Lock()
	roomIDs := make([]string, 0, len(h.rooms))
	for id := range h.rooms {
		roomIDs = append(roomIDs, id)
	}
	h.mu.Unlock()

	h.mu.Lock()
	defer h.mu.Unlock()
	for _, id := range roomIDs {
		h.closeRoom(id, "session:closed")
	}
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

func cloneShallow(m map[string]any) map[string]any {
	out := make(map[string]any, len(m))
	for k, v := range m {
		out[k] = v
	}
	return out
}

func removeString(list []string, value string) []string {
	for i, item := range list {
		if item == value {
			return append(list[:i:i], list[i+1:]...)
		}
	}
	return list
}

func orNA(s string) string {
	if s == "" {
		return "n/a"
	}
	return s
}

func orNone(s string) string {
	if s == "" {
		return "none"
	}
	return s
}
