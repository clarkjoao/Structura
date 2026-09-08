package collab

import (
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"testing"
	"time"
)

// ---------------------------------------------------------------------------
// Test doubles
// ---------------------------------------------------------------------------

// fakeConn records what the server sent it. A pointer type, because the hub
// keys socket state by Conn.
type fakeConn struct {
	name        string
	frames      []map[string]any
	closed      bool
	closeCode   int
	closeReason string
	terminated  bool
	buffered    int
}

func newConn(name string) *fakeConn { return &fakeConn{name: name} }

func (c *fakeConn) Send(data []byte) {
	var decoded map[string]any
	if err := json.Unmarshal(data, &decoded); err != nil {
		panic("server sent invalid JSON: " + err.Error())
	}
	c.frames = append(c.frames, decoded)
}
func (c *fakeConn) Close(code int, reason string) {
	c.closed, c.closeCode, c.closeReason = true, code, reason
}
func (c *fakeConn) Terminate()          { c.terminated = true }
func (c *fakeConn) BufferedAmount() int { return c.buffered }
func (c *fakeConn) IsOpen() bool        { return !c.closed }

// only returns every frame of one type.
func (c *fakeConn) only(frameType string) []map[string]any {
	var out []map[string]any
	for _, f := range c.frames {
		if f["type"] == frameType {
			out = append(out, f)
		}
	}
	return out
}

func (c *fakeConn) last(frameType string) map[string]any {
	frames := c.only(frameType)
	if len(frames) == 0 {
		return nil
	}
	return frames[len(frames)-1]
}

func (c *fakeConn) count(frameType string) int { return len(c.only(frameType)) }

func (c *fakeConn) reset() { c.frames = nil }

// fakeClock runs scheduled work only when the test advances it.
type fakeClock struct {
	now    time.Time
	timers []*fakeTimer
}

type fakeTimer struct {
	at      time.Time
	fn      func()
	stopped bool
}

func (t *fakeTimer) Stop() { t.stopped = true }

func newClock() *fakeClock {
	return &fakeClock{now: time.Date(2026, 9, 4, 12, 0, 0, 0, time.UTC)}
}

func (c *fakeClock) Now() time.Time { return c.now }

func (c *fakeClock) AfterFunc(d time.Duration, f func()) Timer {
	t := &fakeTimer{at: c.now.Add(d), fn: f}
	c.timers = append(c.timers, t)
	return t
}

// advance moves time forward and fires everything due, oldest first.
func (c *fakeClock) advance(d time.Duration) {
	target := c.now.Add(d)
	for {
		var next *fakeTimer
		for _, t := range c.timers {
			if t.stopped || t.at.After(target) {
				continue
			}
			if next == nil || t.at.Before(next.at) {
				next = t
			}
		}
		if next == nil {
			break
		}
		next.stopped = true
		c.now = next.at
		next.fn()
	}
	c.now = target
}

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

type harness struct {
	t     *testing.T
	hub   *Hub
	clock *fakeClock
	logs  []string
	ids   int
}

func newHarness(t *testing.T) *harness {
	t.Helper()
	clock := newClock()
	h := &harness{t: t, clock: clock, hub: NewHub(clock)}
	h.hub.Logf = func(format string, args ...any) {
		h.logs = append(h.logs, fmt.Sprintf(format, args...))
	}
	h.hub.NewID = func() string {
		h.ids++
		return fmt.Sprintf("op-%d", h.ids)
	}
	h.hub.Rand = func() string {
		h.ids++
		return fmt.Sprintf("r%d", h.ids)
	}
	return h
}

func (h *harness) send(conn *fakeConn, message map[string]any) {
	h.t.Helper()
	raw, err := json.Marshal(message)
	if err != nil {
		h.t.Fatalf("marshal: %v", err)
	}
	h.hub.HandleMessage(conn, raw)
}

// hostJoin opens a room and returns the host socket.
func (h *harness) hostJoin(roomID string, snapshot map[string]any) *fakeConn {
	h.t.Helper()
	host := newConn("host")
	h.send(host, map[string]any{
		"type":     "host:join",
		"protocol": ProtocolVersion,
		"roomId":   roomID,
		"user":     map[string]any{"id": "host-1", "name": "Host", "color": "#000"},
		"snapshot": snapshot,
	})
	if host.last("host:ack") == nil {
		h.t.Fatalf("host:join did not ack; frames=%v", host.frames)
	}
	return host
}

func (h *harness) guestJoin(roomID, id string, extra map[string]any) *fakeConn {
	h.t.Helper()
	guest := newConn(id)
	message := map[string]any{
		"type":     "guest:join",
		"protocol": ProtocolVersion,
		"roomId":   roomID,
		"user":     map[string]any{"id": id, "name": id, "color": "#fff"},
	}
	for k, v := range extra {
		message[k] = v
	}
	h.send(guest, message)
	return guest
}

func (h *harness) patch(conn *fakeConn, kind, roomID string, patch map[string]any, extra map[string]any) {
	h.t.Helper()
	message := map[string]any{"type": kind, "roomId": roomID, "patch": patch}
	for k, v := range extra {
		message[k] = v
	}
	h.send(conn, message)
}

func errorCode(conn *fakeConn) string {
	frame := conn.last("error")
	if frame == nil {
		return ""
	}
	code, _ := frame["code"].(string)
	return code
}

// ---------------------------------------------------------------------------
// Checksum parity — vectors produced by the TypeScript implementation
// ---------------------------------------------------------------------------

// These come from running server/src/snapshotChecksum.ts. A client that hashes
// its own state must land on the same 16 hex digits, or the drift detector
// fires on a room that never drifted.
func TestSnapshotChecksumMatchesTypeScript(t *testing.T) {
	vectors := []struct {
		name     string
		json     string // nil snapshot when empty
		expected string
	}{
		{"nil", "", "0000000000000000"},
		{"empty", `{}`, "7caa036145312e87"},
		{"scalarsOnly", `{"diagramName":"D","description":null}`, "dd8cdfaed75a0b8c"},
		{"oneComponent", `{"components":{"a":{"id":"a","name":"A"}}}`, "6ee27865d315b5c3"},
		{"keyOrderSwapped", `{"components":{"a":{"name":"A","id":"a"}}}`, "6ee27865d315b5c3"},
		{"twoEntities", `{"components":{"b":{"id":"b"},"a":{"id":"a"}}}`, "a2b3b68403144516"},
		{"twoEntitiesReordered", `{"components":{"a":{"id":"a"},"b":{"id":"b"}}}`, "a2b3b68403144516"},
		{"nested", `{"nodeLayouts":{"a":{"elementId":"a","x":10,"y":-2.5}}}`, "5b217967dce8d6e1"},
		{"arrays", `{"flows":{"f":{"steps":[1,"two",null,{"z":1,"a":2}]}}}`, "36f438db03ed5cdd"},
		{"undefinedVsMissing", `{"components":{"a":{"id":"a"}}}`, "67ad94fbe18eb0a5"},
		{"explicitNull", `{"components":{"a":{"id":"a","tags":null}}}`, "e4579041de6619bb"},
		{"unsyncedKeyIgnored", `{"components":{},"viewport":{"x":1,"y":2},"id":"nope"}`, "3b8713165e54a21c"},
		{"unicode", `{"diagramName":"coração 🇧🇷 <b>&"}`, "19f19832eb7c19dc"},
		{"booleans", `{"components":{"a":{"locked":true,"hidden":false}}}`, "55c0129007a63b2a"},
		{"allKeys", `{"activeSceneId":"s1","compareSceneId":null,"components":{"a":{"id":"a"}},` +
			`"connections":{"c":{"id":"c"}},"description":"d","diagramName":"n","domain":"dom",` +
			`"edgeLayouts":{"e":{"id":"e"}},"flows":{"f":{"id":"f"}},"iconLibrary":{"i":{"id":"i"}},` +
			`"nodeLayouts":{"l":{"x":0}},"scenes":{"s":{"id":"s"}}}`, "1e8b44c08d1cbcce"},
	}

	for _, v := range vectors {
		t.Run(v.name, func(t *testing.T) {
			var snapshot map[string]any
			if v.json != "" {
				if err := json.Unmarshal([]byte(v.json), &snapshot); err != nil {
					t.Fatalf("bad vector: %v", err)
				}
			}
			if got := SnapshotChecksum(snapshot); got != v.expected {
				t.Fatalf("checksum = %s, TypeScript says %s", got, v.expected)
			}
		})
	}
}

func TestChecksumIgnoresKeysThatCannotBeSynced(t *testing.T) {
	// Hashing a field no patch can carry would report drift no resync can fix.
	base := map[string]any{"components": map[string]any{"a": map[string]any{"id": "a"}}}
	withExtra := map[string]any{
		"components": map[string]any{"a": map[string]any{"id": "a"}},
		"viewport":   map[string]any{"x": 1.0},
		"level":      "context",
	}
	if SnapshotChecksum(base) != SnapshotChecksum(withExtra) {
		t.Fatal("unsynced keys changed the fingerprint")
	}
}

// ---------------------------------------------------------------------------
// Join and protocol
// ---------------------------------------------------------------------------

func TestHostJoinAcksWithVersionAndProtocol(t *testing.T) {
	h := newHarness(t)
	host := h.hostJoin("r1", map[string]any{"components": map[string]any{}})

	ack := host.last("host:ack")
	if ack["resumed"] != false {
		t.Fatalf("resumed = %v, want false", ack["resumed"])
	}
	// A host with no version cannot declare what it had seen when it patches.
	if ack["version"] != float64(0) {
		t.Fatalf("version = %v, want 0", ack["version"])
	}
	if ack["protocol"] != float64(ProtocolVersion) {
		t.Fatalf("protocol = %v, want %d", ack["protocol"], ProtocolVersion)
	}
}

func TestJoinWithoutProtocolIsRefused(t *testing.T) {
	// A v1 client reads "these entities changed" as "the collection is now only
	// these" and wipes the diagram. Refuse rather than corrupt.
	h := newHarness(t)
	conn := newConn("old-client")
	h.send(conn, map[string]any{
		"type":     "host:join",
		"roomId":   "r1",
		"user":     map[string]any{"id": "u", "name": "u", "color": "#000"},
		"snapshot": map[string]any{},
	})

	if got := errorCode(conn); got != "protocol_mismatch" {
		t.Fatalf("code = %q, want protocol_mismatch", got)
	}
	if !conn.closed {
		t.Fatal("socket should be closed on protocol mismatch")
	}
	if h.hub.Room("r1") != nil {
		t.Fatal("a mismatched join must not create a room")
	}
}

func TestSecondHostForSameRoomIsRefused(t *testing.T) {
	h := newHarness(t)
	h.hostJoin("r1", map[string]any{})

	other := newConn("host-2")
	h.send(other, map[string]any{
		"type":     "host:join",
		"protocol": ProtocolVersion,
		"roomId":   "r1",
		"user":     map[string]any{"id": "host-2", "name": "H2", "color": "#000"},
		"snapshot": map[string]any{},
	})
	if got := errorCode(other); got != "room_exists" {
		t.Fatalf("code = %q, want room_exists", got)
	}
}

func TestGuestJoinGetsSnapshotAndPeers(t *testing.T) {
	h := newHarness(t)
	h.hostJoin("r1", map[string]any{"components": map[string]any{"a": map[string]any{"id": "a"}}})
	first := h.guestJoin("r1", "g1", nil)
	second := h.guestJoin("r1", "g2", nil)

	init := second.last("session:init")
	if init == nil {
		t.Fatal("no session:init")
	}
	if init["snapshot"] == nil {
		t.Fatal("a fresh guest must get the snapshot")
	}
	if init["clientId"] != "g2" {
		t.Fatalf("clientId = %v, want g2", init["clientId"])
	}
	if init["participantCount"] != float64(3) {
		t.Fatalf("participantCount = %v, want 3", init["participantCount"])
	}
	peers, _ := init["peers"].([]any)
	if len(peers) != 1 {
		t.Fatalf("peers = %v, want just g1", peers)
	}
	// The already-present guest is told, the joiner is not told about itself.
	if first.count("peer:joined") != 1 {
		t.Fatalf("g1 saw %d peer:joined, want 1", first.count("peer:joined"))
	}
	if second.count("peer:joined") != 0 {
		t.Fatal("a joiner must not be told about its own arrival")
	}
}

func TestRoomIsFullAtFifteen(t *testing.T) {
	h := newHarness(t)
	h.hostJoin("r1", map[string]any{})
	for i := 0; i < MaxParticipants-1; i++ {
		h.guestJoin("r1", fmt.Sprintf("g%d", i), nil)
	}
	if got := h.hub.Room("r1").PeerCount(); got != MaxParticipants {
		t.Fatalf("PeerCount = %d, want %d", got, MaxParticipants)
	}

	overflow := h.guestJoin("r1", "one-too-many", nil)
	if got := errorCode(overflow); got != "room_full" {
		t.Fatalf("code = %q, want room_full", got)
	}
	if !overflow.closed {
		t.Fatal("a refused guest should be closed")
	}
}

func TestCollidingGuestIDIsRenamed(t *testing.T) {
	h := newHarness(t)
	h.hostJoin("r1", map[string]any{})
	h.guestJoin("r1", "same", nil)
	second := h.guestJoin("r1", "same", nil)

	assigned, _ := second.last("session:init")["clientId"].(string)
	if assigned == "same" || !strings.HasPrefix(assigned, "same-") {
		t.Fatalf("clientId = %q, want a de-collided id", assigned)
	}
	if ids := h.hub.Room("r1").GuestIDs(); len(ids) != 2 {
		t.Fatalf("guests = %v, want two distinct", ids)
	}
}

// ---------------------------------------------------------------------------
// Patch merge
// ---------------------------------------------------------------------------

func TestPatchMergesPerEntityAndLeavesSiblingsAlone(t *testing.T) {
	h := newHarness(t)
	host := h.hostJoin("r1", map[string]any{
		"nodeLayouts": map[string]any{
			"a": map[string]any{"x": 0.0},
			"b": map[string]any{"x": 0.0},
		},
	})

	h.patch(host, "host:patch", "r1",
		map[string]any{"nodeLayouts": map[string]any{"a": map[string]any{"x": 99.0}}}, nil)

	layouts := h.hub.Room("r1").Snapshot["nodeLayouts"].(map[string]any)
	if layouts["a"].(map[string]any)["x"] != 99.0 {
		t.Fatalf("a not moved: %v", layouts["a"])
	}
	if layouts["b"].(map[string]any)["x"] != 0.0 {
		t.Fatalf("b was disturbed: %v", layouts["b"])
	}
}

func TestNullEntityIsATombstone(t *testing.T) {
	h := newHarness(t)
	host := h.hostJoin("r1", map[string]any{
		"components": map[string]any{"a": map[string]any{"id": "a"}},
	})

	h.patch(host, "host:patch", "r1",
		map[string]any{"components": map[string]any{"a": nil}}, nil)

	components := h.hub.Room("r1").Snapshot["components"].(map[string]any)
	if _, present := components["a"]; present {
		t.Fatal("a null entry must delete the entity")
	}
	if at, ok := h.hub.Room("r1").TombstoneAt("components", "a"); !ok || at != 1 {
		t.Fatalf("tombstone = (%d, %v), want version 1", at, ok)
	}
}

func TestScalarKeysAreAssignedWhole(t *testing.T) {
	h := newHarness(t)
	host := h.hostJoin("r1", map[string]any{"diagramName": "Before"})
	h.patch(host, "host:patch", "r1", map[string]any{"diagramName": "After"}, nil)

	if got := h.hub.Room("r1").Snapshot["diagramName"]; got != "After" {
		t.Fatalf("diagramName = %v, want After", got)
	}
}

func TestRemoveWinsOverAConcurrentEdit(t *testing.T) {
	// A peer mid-drag must not resurrect a node someone else deleted — and,
	// because a delete spans several collections while the in-flight edit
	// usually touches one, resurrect it as an orphan.
	h := newHarness(t)
	host := h.hostJoin("r1", map[string]any{
		"components":  map[string]any{"a": map[string]any{"id": "a"}},
		"nodeLayouts": map[string]any{"a": map[string]any{"x": 0.0}},
	})
	guest := h.guestJoin("r1", "g1", nil)

	// Host deletes a at version 1.
	h.patch(host, "host:patch", "r1", map[string]any{
		"components":  map[string]any{"a": nil},
		"nodeLayouts": map[string]any{"a": nil},
	}, map[string]any{"version": 0})

	guest.reset()
	// Guest was still at version 0 when it composed a move of the same node.
	h.patch(guest, "guest:patch", "r1",
		map[string]any{"nodeLayouts": map[string]any{"a": map[string]any{"x": 50.0}}},
		map[string]any{"version": 0})

	layouts := h.hub.Room("r1").Snapshot["nodeLayouts"].(map[string]any)
	if _, present := layouts["a"]; present {
		t.Fatalf("the delete lost to a stale edit: %v", layouts)
	}
	// Nothing landed, so nothing may be broadcast: peers applying a suppressed
	// write would drift from the server's own snapshot.
	if guest.count("session:patch") != 0 {
		t.Fatalf("a suppressed write was broadcast: %v", guest.only("session:patch"))
	}
	// The ACK still goes out, so the sender is not left waiting.
	if guest.count("OP_ACK") != 1 {
		t.Fatal("sender must still be acked")
	}
}

func TestASenderThatSawTheDeleteMayRecreateTheEntity(t *testing.T) {
	h := newHarness(t)
	host := h.hostJoin("r1", map[string]any{"components": map[string]any{"a": map[string]any{"id": "a"}}})
	guest := h.guestJoin("r1", "g1", nil)

	h.patch(host, "host:patch", "r1", map[string]any{"components": map[string]any{"a": nil}}, nil)

	// Version 1 is the delete, so this sender already knew: it is deliberately
	// re-creating the entity.
	h.patch(guest, "guest:patch", "r1",
		map[string]any{"components": map[string]any{"a": map[string]any{"id": "a", "name": "again"}}},
		map[string]any{"version": 1})

	components := h.hub.Room("r1").Snapshot["components"].(map[string]any)
	entity, ok := components["a"].(map[string]any)
	if !ok || entity["name"] != "again" {
		t.Fatalf("deliberate re-create was blocked: %v", components)
	}
	if _, stillThere := h.hub.Room("r1").TombstoneAt("components", "a"); stillThere {
		t.Fatal("the tombstone should be cleared once honoured")
	}
}

func TestPatchWithoutDeclaredVersionIsNotBlocked(t *testing.T) {
	// A client that declares nothing cannot be evaluated, so the write passes.
	h := newHarness(t)
	host := h.hostJoin("r1", map[string]any{"components": map[string]any{"a": map[string]any{"id": "a"}}})
	h.patch(host, "host:patch", "r1", map[string]any{"components": map[string]any{"a": nil}}, nil)

	guest := h.guestJoin("r1", "g1", nil)
	h.patch(guest, "guest:patch", "r1",
		map[string]any{"components": map[string]any{"a": map[string]any{"id": "a"}}}, nil)

	components := h.hub.Room("r1").Snapshot["components"].(map[string]any)
	if _, present := components["a"]; !present {
		t.Fatal("a write with no declared version should pass")
	}
}

func TestDangerousPatchKeysAreRefused(t *testing.T) {
	h := newHarness(t)
	host := h.hostJoin("r1", map[string]any{})
	h.patch(host, "host:patch", "r1", map[string]any{"__proto__": map[string]any{"x": 1.0}}, nil)

	if got := errorCode(host); got != "invalid_host_patch" {
		t.Fatalf("code = %q, want invalid_host_patch", got)
	}
	if h.hub.Room("r1").Version != 0 {
		t.Fatal("a refused patch must not advance the version")
	}
}

// ---------------------------------------------------------------------------
// Broadcast
// ---------------------------------------------------------------------------

func TestSenderReceivesItsOwnPatch(t *testing.T) {
	// Excluding the sender left a hole in the only ordered view it has of the
	// room: with its own operations missing, a peer's older patch that arrived
	// afterwards became its final state while the server had moved on.
	h := newHarness(t)
	h.hostJoin("r1", map[string]any{})
	guest := h.guestJoin("r1", "g1", nil)
	guest.reset()

	h.patch(guest, "guest:patch", "r1",
		map[string]any{"nodeLayouts": map[string]any{"a": map[string]any{"x": 1.0}}}, nil)

	frames := guest.only("session:patch")
	if len(frames) != 1 {
		t.Fatalf("sender saw %d session:patch frames, want 1", len(frames))
	}
	if frames[0]["clientId"] != "g1" {
		t.Fatalf("clientId = %v, want g1 so the sender can recognise its own", frames[0]["clientId"])
	}
	if frames[0]["version"] != float64(1) {
		t.Fatalf("version = %v, want 1", frames[0]["version"])
	}
}

func TestPeerJoinedStillExcludesTheJoiner(t *testing.T) {
	// The sender-inclusion change applies to patches, not to peer:joined.
	h := newHarness(t)
	host := h.hostJoin("r1", map[string]any{})
	guest := h.guestJoin("r1", "g1", nil)

	if host.count("peer:joined") != 1 {
		t.Fatalf("host saw %d peer:joined, want 1", host.count("peer:joined"))
	}
	if guest.count("peer:joined") != 0 {
		t.Fatal("the joiner must not be told about itself")
	}
}

// ---------------------------------------------------------------------------
// Checksum publication
// ---------------------------------------------------------------------------

func TestChecksumIsPublishedEveryNOperations(t *testing.T) {
	h := newHarness(t)
	host := h.hostJoin("r1", map[string]any{"components": map[string]any{}})
	host.reset()

	for i := 0; i < ChecksumIntervalOps-1; i++ {
		h.patch(host, "host:patch", "r1",
			map[string]any{"components": map[string]any{fmt.Sprintf("c%d", i): map[string]any{"i": float64(i)}}}, nil)
	}
	if got := host.count("sync:checksum"); got != 0 {
		t.Fatalf("published %d fingerprints before the threshold, want 0", got)
	}

	h.patch(host, "host:patch", "r1",
		map[string]any{"components": map[string]any{"last": map[string]any{"i": 1.0}}}, nil)

	if got := host.count("sync:checksum"); got != 1 {
		t.Fatalf("published %d fingerprints at the threshold, want 1", got)
	}
}

func TestChecksumIsPublishedWhenTheRoomFallsQuiet(t *testing.T) {
	// Publishing only every N operations leaves the last window of a burst
	// unverified: a client that drifted on one of those final operations stays
	// wrong with nobody looking.
	h := newHarness(t)
	host := h.hostJoin("r1", map[string]any{"components": map[string]any{}})
	host.reset()

	h.patch(host, "host:patch", "r1",
		map[string]any{"components": map[string]any{"a": map[string]any{"id": "a"}}}, nil)
	if host.count("sync:checksum") != 0 {
		t.Fatal("one operation is far below the count threshold")
	}

	h.clock.advance(ChecksumIdle + time.Millisecond)

	frames := host.only("sync:checksum")
	if len(frames) != 1 {
		t.Fatalf("published %d fingerprints after going idle, want 1", len(frames))
	}
	if frames[0]["version"] != float64(1) {
		t.Fatalf("version = %v, want 1", frames[0]["version"])
	}
}

func TestChecksumMatchesAClientThatAppliedTheSamePatches(t *testing.T) {
	// The whole point: a client hashing its own state must land on the server's
	// value, or the detector fires on a room that never drifted.
	h := newHarness(t)
	host := h.hostJoin("r1", map[string]any{"components": map[string]any{}})
	host.reset()

	client := map[string]any{"components": map[string]any{}}
	for i := 0; i < ChecksumIntervalOps; i++ {
		id := fmt.Sprintf("c%d", i)
		entity := map[string]any{"id": id, "x": float64(i)}
		h.patch(host, "host:patch", "r1",
			map[string]any{"components": map[string]any{id: entity}}, nil)
		client["components"].(map[string]any)[id] = entity
	}

	frame := host.last("sync:checksum")
	if frame == nil {
		t.Fatal("no fingerprint published")
	}
	if got := SnapshotChecksum(client); got != frame["checksum"] {
		t.Fatalf("client %s != server %v", got, frame["checksum"])
	}
}

func TestChecksumIsNotRepublishedAtTheSameVersion(t *testing.T) {
	h := newHarness(t)
	host := h.hostJoin("r1", map[string]any{})
	host.reset()

	h.patch(host, "host:patch", "r1", map[string]any{"diagramName": "x"}, nil)
	h.clock.advance(ChecksumIdle * 3)
	first := host.count("sync:checksum")

	h.clock.advance(ChecksumIdle * 3)
	if host.count("sync:checksum") != first {
		t.Fatal("an idle room must not keep republishing the same fingerprint")
	}
}

func TestChecksumMismatchAsksForAFullSnapshot(t *testing.T) {
	// A mismatch means the content is wrong, not that operations are missing —
	// the client is usually at the right version, so a replay would send it
	// nothing.
	h := newHarness(t)
	host := h.hostJoin("r1", map[string]any{"components": map[string]any{"a": map[string]any{"id": "a"}}})
	guest := h.guestJoin("r1", "g1", nil)
	h.patch(host, "host:patch", "r1", map[string]any{"diagramName": "x"}, nil)
	guest.reset()

	h.send(guest, map[string]any{
		"type":        "sync:request",
		"roomId":      "r1",
		"baseVersion": h.hub.Room("r1").Version,
		"reason":      "checksum",
	})

	frame := guest.last("SYNC_SNAPSHOT")
	if frame == nil {
		t.Fatalf("want SYNC_SNAPSHOT, got %v", guest.frames)
	}
	if frame["snapshot"] == nil {
		t.Fatal("the repair must carry the snapshot")
	}
}

func TestSyncRequestAtTheCurrentVersionReplaysNothing(t *testing.T) {
	h := newHarness(t)
	host := h.hostJoin("r1", map[string]any{})
	guest := h.guestJoin("r1", "g1", nil)
	h.patch(host, "host:patch", "r1", map[string]any{"diagramName": "x"}, nil)
	guest.reset()

	h.send(guest, map[string]any{
		"type": "sync:request", "roomId": "r1", "baseVersion": h.hub.Room("r1").Version,
	})

	frame := guest.last("SYNC_COMPLETE")
	if frame == nil {
		t.Fatalf("want SYNC_COMPLETE, got %v", guest.frames)
	}
	if ops, _ := frame["operations"].([]any); len(ops) != 0 {
		t.Fatalf("operations = %v, want none", ops)
	}
}

// ---------------------------------------------------------------------------
// Operation log and resume
// ---------------------------------------------------------------------------

func TestResumeReplaysOnlyWhatWasMissed(t *testing.T) {
	h := newHarness(t)
	host := h.hostJoin("r1", map[string]any{"components": map[string]any{}})
	for i := 0; i < 3; i++ {
		h.patch(host, "host:patch", "r1",
			map[string]any{"components": map[string]any{fmt.Sprintf("c%d", i): map[string]any{"i": float64(i)}}}, nil)
	}

	rejoining := h.guestJoin("r1", "g1", map[string]any{"resumeFrom": 1})
	init := rejoining.last("session:init")

	if init["snapshot"] != nil {
		t.Fatal("a resumable client must not be sent the whole diagram")
	}
	ops, _ := init["operations"].([]any)
	if len(ops) != 2 {
		t.Fatalf("replayed %d operations, want 2", len(ops))
	}
	first := ops[0].(map[string]any)
	if first["version"] != float64(2) {
		t.Fatalf("replay starts at version %v, want 2", first["version"])
	}
}

func TestResumeFallsBackToTheSnapshotWhenTheLogHasAHole(t *testing.T) {
	// The log is trimmed by count and bytes, so coverage is not guaranteed. The
	// oldest op held must be the very next one the client needs.
	h := newHarness(t)
	host := h.hostJoin("r1", map[string]any{"components": map[string]any{}})
	for i := 0; i < 3; i++ {
		h.patch(host, "host:patch", "r1",
			map[string]any{"components": map[string]any{fmt.Sprintf("c%d", i): map[string]any{}}}, nil)
	}
	// Evict the oldest operation, leaving versions 2 and 3.
	room := h.hub.Room("r1")
	room.OperationLog = room.OperationLog[1:]

	rejoining := h.guestJoin("r1", "g1", map[string]any{"resumeFrom": 0})
	init := rejoining.last("session:init")
	if init["snapshot"] == nil {
		t.Fatal("a hole in the log must fall back to the snapshot")
	}
	if init["operations"] != nil {
		t.Fatal("a hole must not be replayed as if it were complete")
	}
}

func TestOperationLogEvictsOldestPastTheByteBudget(t *testing.T) {
	room := &Room{Snapshot: map[string]any{}}
	for i := 1; i <= 4; i++ {
		appendOperation(room, Operation{Version: i, Bytes: MaxOperationLogBytes / 2})
	}

	if len(room.OperationLog) != 2 {
		t.Fatalf("log holds %d ops, want the 2 that fit the budget", len(room.OperationLog))
	}
	if room.OperationLog[0].Version != 3 {
		t.Fatalf("oldest kept is version %d, want 3 — eviction is oldest-first",
			room.OperationLog[0].Version)
	}
}

func TestPeriodicSnapshotTrimsTheLogAndPrunesTombstones(t *testing.T) {
	h := newHarness(t)
	host := h.hostJoin("r1", map[string]any{"components": map[string]any{}})
	room := h.hub.Room("r1")

	h.patch(host, "host:patch", "r1",
		map[string]any{"components": map[string]any{"gone": map[string]any{"id": "gone"}}}, nil)
	h.patch(host, "host:patch", "r1",
		map[string]any{"components": map[string]any{"gone": nil}}, nil)
	if _, ok := room.TombstoneAt("components", "gone"); !ok {
		t.Fatal("expected a tombstone before the snapshot")
	}

	host.reset()
	for room.Version < SnapshotIntervalOps {
		// Stay inside the per-second budget: 100 operations from one client
		// trip the rate limit half way, the version stops advancing and this
		// loop never ends.
		if room.Version%(MaxOpsPerSecond/2) == 0 {
			h.clock.advance(RateWindow + time.Millisecond)
		}
		h.patch(host, "host:patch", "r1",
			map[string]any{"components": map[string]any{fmt.Sprintf("c%d", room.Version): map[string]any{}}}, nil)
		if code := errorCode(host); code != "" {
			t.Fatalf("unexpected error while filling the log: %s", code)
		}
	}

	if host.count("PERIODIC_SNAPSHOT") != 1 {
		t.Fatalf("took %d snapshots, want 1", host.count("PERIODIC_SNAPSHOT"))
	}
	if room.SnapshotAtVersion != SnapshotIntervalOps {
		t.Fatalf("SnapshotAtVersion = %d, want %d", room.SnapshotAtVersion, SnapshotIntervalOps)
	}
	// Anyone that far behind is served the snapshot itself, so the delete can
	// no longer be contradicted.
	if _, ok := room.TombstoneAt("components", "gone"); ok {
		t.Fatal("tombstones older than the snapshot should be pruned")
	}
}

// ---------------------------------------------------------------------------
// Cursors
// ---------------------------------------------------------------------------

func TestCursorsAreCoalescedIntoOneFramePerTick(t *testing.T) {
	// Relaying each cursor immediately cost one send per peer per event: a full
	// room at 30Hz was 6,300 sends/s from one room alone.
	h := newHarness(t)
	host := h.hostJoin("r1", map[string]any{})
	guest := h.guestJoin("r1", "g1", nil)
	host.reset()
	guest.reset()

	for i := 0; i < 20; i++ {
		h.send(guest, map[string]any{
			"type": "peer:cursor", "roomId": "r1",
			"cursor": map[string]any{"x": float64(i), "y": float64(i)},
		})
	}
	if host.count("peer:cursors") != 0 {
		t.Fatal("cursors must not be relayed before the tick")
	}

	h.clock.advance(CursorFlush + time.Millisecond)

	frames := host.only("peer:cursors")
	if len(frames) != 1 {
		t.Fatalf("sent %d cursor frames for 20 moves, want 1", len(frames))
	}
	cursors, _ := frames[0]["cursors"].([]any)
	if len(cursors) != 1 {
		t.Fatalf("frame carries %d entries, want 1 coalesced entry", len(cursors))
	}
	// Only the newest position survives.
	position := cursors[0].(map[string]any)["cursor"].(map[string]any)
	if position["x"] != float64(19) {
		t.Fatalf("x = %v, want the newest (19)", position["x"])
	}
}

func TestCursorFrameIncludesTheRecipientSoTheRoomMarshalsOnce(t *testing.T) {
	h := newHarness(t)
	h.hostJoin("r1", map[string]any{})
	guest := h.guestJoin("r1", "g1", nil)
	guest.reset()

	h.send(guest, map[string]any{
		"type": "peer:cursor", "roomId": "r1", "cursor": map[string]any{"x": 1.0, "y": 2.0},
	})
	h.clock.advance(CursorFlush * 2)

	frame := guest.last("peer:cursors")
	if frame == nil {
		t.Fatal("the sender should receive the coalesced frame too")
	}
	cursors, _ := frame["cursors"].([]any)
	if len(cursors) != 1 || cursors[0].(map[string]any)["clientId"] != "g1" {
		t.Fatalf("cursors = %v; clients drop their own entry by clientId", cursors)
	}
}

func TestExplicitNullCursorIsValidAndAbsentIsNot(t *testing.T) {
	h := newHarness(t)
	h.hostJoin("r1", map[string]any{})
	guest := h.guestJoin("r1", "g1", nil)
	guest.reset()

	h.send(guest, map[string]any{"type": "peer:cursor", "roomId": "r1", "cursor": nil})
	if errorCode(guest) != "" {
		t.Fatalf("an explicit null cursor is how a client says it left the canvas; got %q",
			errorCode(guest))
	}

	h.send(guest, map[string]any{"type": "peer:cursor", "roomId": "r1"})
	if got := errorCode(guest); got != "invalid_peer_cursor" {
		t.Fatalf("code = %q, want invalid_peer_cursor for an absent cursor", got)
	}
}

func TestLossyFramesAreDroppedForASlowClient(t *testing.T) {
	h := newHarness(t)
	host := h.hostJoin("r1", map[string]any{})
	guest := h.guestJoin("r1", "g1", nil)
	host.buffered = MaxBufferedBytes + 1
	host.reset()

	h.send(guest, map[string]any{
		"type": "peer:cursor", "roomId": "r1", "cursor": map[string]any{"x": 1.0, "y": 1.0},
	})
	h.clock.advance(CursorFlush * 2)

	if host.count("peer:cursors") != 0 {
		t.Fatal("cursor frames are superseded by the next one; drop rather than queue")
	}

	// A state-bearing frame is always queued, however backed up the client is.
	h.patch(guest, "guest:patch", "r1", map[string]any{"diagramName": "x"}, nil)
	if host.count("session:patch") != 1 {
		t.Fatal("a patch must never be dropped for backpressure")
	}
}

// ---------------------------------------------------------------------------
// Limits
// ---------------------------------------------------------------------------

func TestRateLimitIsPerRoomAndClient(t *testing.T) {
	h := newHarness(t)
	host := h.hostJoin("r1", map[string]any{})

	for i := 0; i < MaxOpsPerSecond; i++ {
		h.patch(host, "host:patch", "r1", map[string]any{"diagramName": fmt.Sprint(i)}, nil)
	}
	if errorCode(host) != "" {
		t.Fatalf("hit the limit early: %q", errorCode(host))
	}

	h.patch(host, "host:patch", "r1", map[string]any{"diagramName": "over"}, nil)
	if got := errorCode(host); got != "rate_limited" {
		t.Fatalf("code = %q, want rate_limited", got)
	}

	// Fixed window: the budget refills once the window rolls over.
	h.clock.advance(RateWindow + time.Millisecond)
	host.reset()
	h.patch(host, "host:patch", "r1", map[string]any{"diagramName": "next window"}, nil)
	if got := errorCode(host); got != "" {
		t.Fatalf("still limited after the window rolled: %q", got)
	}
}

func TestOversizedBatchIsRefused(t *testing.T) {
	h := newHarness(t)
	host := h.hostJoin("r1", map[string]any{})
	h.patch(host, "host:patch", "r1", map[string]any{"diagramName": "x"},
		map[string]any{"batched": MaxBatchSize + 1})

	if got := errorCode(host); got != "batch_too_large" {
		t.Fatalf("code = %q, want batch_too_large", got)
	}
	if h.hub.Room("r1").Version != 0 {
		t.Fatal("a refused batch must not advance the version")
	}
}

func TestOversizedPayloadIsRefusedWithoutParsing(t *testing.T) {
	h := newHarness(t)
	host := h.hostJoin("r1", map[string]any{})
	host.reset()

	oversized := make([]byte, MaxPayloadSizeBytes+1)
	for i := range oversized {
		oversized[i] = 'x'
	}
	h.hub.HandleMessage(host, oversized)

	if got := errorCode(host); got != "invalid_json" {
		t.Fatalf("code = %q, want invalid_json", got)
	}
}

func TestUnknownMessageTypeIsReported(t *testing.T) {
	h := newHarness(t)
	conn := newConn("c")
	h.send(conn, map[string]any{"type": "nonsense"})
	if got := errorCode(conn); got != "unsupported_message" {
		t.Fatalf("code = %q, want unsupported_message", got)
	}

	h.send(conn, map[string]any{"roomId": "r1"})
	if got := errorCode(conn); got != "missing_type" {
		t.Fatalf("code = %q, want missing_type", got)
	}
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

func TestHostDisconnectGivesAGraceWindowThenClosesTheRoom(t *testing.T) {
	h := newHarness(t)
	host := h.hostJoin("r1", map[string]any{})
	guest := h.guestJoin("r1", "g1", nil)
	guest.reset()

	h.hub.HandleClose(host)
	if guest.count("host:reconnecting") != 1 {
		t.Fatal("guests should be told the host is reconnecting")
	}
	if h.hub.Room("r1") == nil {
		t.Fatal("the room must survive the grace window")
	}

	h.clock.advance(HostReconnectWait + time.Millisecond)
	if h.hub.Room("r1") != nil {
		t.Fatal("the room should close once the host fails to return")
	}
	if guest.count("host:disconnected") != 1 {
		t.Fatalf("guest frames = %v, want host:disconnected", guest.frames)
	}
	if !guest.closed {
		t.Fatal("guest sockets should be closed with the room")
	}
}

func TestHostReconnectWithinTheWindowKeepsTheRoom(t *testing.T) {
	h := newHarness(t)
	host := h.hostJoin("r1", map[string]any{"components": map[string]any{}})
	h.patch(host, "host:patch", "r1",
		map[string]any{"components": map[string]any{"a": map[string]any{"id": "a"}}}, nil)
	guest := h.guestJoin("r1", "g1", nil)
	guest.reset()

	h.hub.HandleClose(host)
	h.clock.advance(HostReconnectWait / 2)

	returning := newConn("host-again")
	h.send(returning, map[string]any{
		"type": "host:join", "protocol": ProtocolVersion, "roomId": "r1",
		"user":     map[string]any{"id": "host-1", "name": "Host", "color": "#000"},
		"snapshot": map[string]any{},
	})

	ack := returning.last("host:ack")
	if ack == nil || ack["resumed"] != true {
		t.Fatalf("host:ack = %v, want resumed", ack)
	}
	if ack["version"] != float64(1) {
		t.Fatalf("version = %v, want the room's 1", ack["version"])
	}
	// The room's state wins over whatever the returning host brought.
	if ack["snapshot"] == nil {
		t.Fatal("a host with no resumeFrom gets the room snapshot")
	}
	if guest.count("host:reconnected") != 1 {
		t.Fatal("guests should be told the host came back")
	}
	// The grace timer must not fire and close a room that recovered.
	h.clock.advance(HostReconnectWait * 2)
	if h.hub.Room("r1") == nil {
		t.Fatal("the reconnect timer was not cancelled")
	}
}

func TestHostCloseEndsTheSession(t *testing.T) {
	h := newHarness(t)
	host := h.hostJoin("r1", map[string]any{})
	guest := h.guestJoin("r1", "g1", nil)
	guest.reset()

	h.send(host, map[string]any{"type": "host:close", "roomId": "r1"})

	if h.hub.Room("r1") != nil {
		t.Fatal("host:close should remove the room")
	}
	if guest.count("session:closed") != 1 {
		t.Fatalf("guest frames = %v, want session:closed", guest.frames)
	}
}

func TestGuestLeaveIsAnnouncedWithTheNewCount(t *testing.T) {
	h := newHarness(t)
	host := h.hostJoin("r1", map[string]any{})
	leaving := h.guestJoin("r1", "g1", nil)
	h.guestJoin("r1", "g2", nil)
	host.reset()

	h.hub.HandleClose(leaving)

	frame := host.last("peer:left")
	if frame == nil {
		t.Fatalf("host frames = %v, want peer:left", host.frames)
	}
	if frame["clientId"] != "g1" {
		t.Fatalf("clientId = %v, want g1", frame["clientId"])
	}
	if frame["participantCount"] != float64(2) {
		t.Fatalf("participantCount = %v, want 2", frame["participantCount"])
	}
	if ids := h.hub.Room("r1").GuestIDs(); len(ids) != 1 || ids[0] != "g2" {
		t.Fatalf("guests = %v, want just g2", ids)
	}
}

func TestHeartbeatTerminatesASocketThatNeverPongs(t *testing.T) {
	h := newHarness(t)
	host := h.hostJoin("r1", map[string]any{})
	guest := h.guestJoin("r1", "g1", nil)
	h.hub.StartHeartbeat()
	host.reset()
	guest.reset()

	h.clock.advance(HeartbeatInterval + time.Millisecond)
	if host.count("ping") != 1 || guest.count("ping") != 1 {
		t.Fatal("every socket should be pinged")
	}

	// The guest answers, the host does not.
	h.send(guest, map[string]any{"type": "pong"})
	h.clock.advance(HeartbeatTimeout + time.Millisecond)

	if !host.terminated {
		t.Fatal("a socket that never pongs should be terminated")
	}
	if guest.terminated {
		t.Fatal("a socket that answered must be left alone")
	}
	h.hub.StopHeartbeat()
}

func TestPingIsAnsweredWithPong(t *testing.T) {
	h := newHarness(t)
	conn := newConn("c")
	h.send(conn, map[string]any{"type": "ping"})
	if conn.count("pong") != 1 {
		t.Fatalf("frames = %v, want a pong", conn.frames)
	}
}

// ---------------------------------------------------------------------------
// Convergence — the property all of the above exists to protect
// ---------------------------------------------------------------------------

// Every participant applying the broadcasts it receives must end byte-equal to
// the server's snapshot. This is the whole reason the sender is included in the
// fan-out and the effective patch is broadcast rather than the received one.
func TestEveryParticipantConvergesOnTheServerSnapshot(t *testing.T) {
	h := newHarness(t)
	host := h.hostJoin("r1", map[string]any{
		"components":  map[string]any{},
		"nodeLayouts": map[string]any{},
	})

	conns := []*fakeConn{host}
	for i := 0; i < 5; i++ {
		conns = append(conns, h.guestJoin("r1", fmt.Sprintf("g%d", i), nil))
	}

	// Each participant tracks what it believes the room holds.
	views := make([]map[string]any, len(conns))
	for i := range views {
		views[i] = map[string]any{"components": map[string]any{}, "nodeLayouts": map[string]any{}}
	}
	for _, c := range conns {
		c.reset()
	}

	// Interleave writes from everyone, including a delete that races an edit.
	for round := 0; round < 8; round++ {
		for i, c := range conns {
			kind := "guest:patch"
			if i == 0 {
				kind = "host:patch"
			}
			id := fmt.Sprintf("n%d", (round*len(conns)+i)%9)
			h.patch(c, kind, "r1", map[string]any{
				"nodeLayouts": map[string]any{id: map[string]any{"x": float64(round), "owner": c.name}},
			}, map[string]any{"version": h.hub.Room("r1").Version})
		}
		if round == 4 {
			// A stale delete from someone who has not seen the latest writes.
			h.patch(conns[1], "guest:patch", "r1",
				map[string]any{"nodeLayouts": map[string]any{"n3": nil}},
				map[string]any{"version": 0})
		}
	}

	// Replay each participant's received stream onto its own view.
	for i, c := range conns {
		for _, frame := range c.only("session:patch") {
			patch, _ := frame["patch"].(map[string]any)
			applyToView(views[i], patch)
		}
	}

	server := SnapshotChecksum(h.hub.Room("r1").Snapshot)
	for i, c := range conns {
		if got := SnapshotChecksum(views[i]); got != server {
			t.Fatalf("%s diverged: %s != server %s", c.name, got, server)
		}
	}
}

// applyToView is the client half of the merge: the same structural rule, with
// null as a tombstone.
func applyToView(view, patch map[string]any) {
	for key, value := range patch {
		collection, isCollection := value.(map[string]any)
		if !isCollection {
			view[key] = value
			continue
		}
		target, ok := view[key].(map[string]any)
		if !ok {
			target = map[string]any{}
			view[key] = target
		}
		for entityID, entityValue := range collection {
			if entityValue == nil {
				delete(target, entityID)
				continue
			}
			target[entityID] = entityValue
		}
	}
}

func TestGuestPatchFromAHostSocketIsRefused(t *testing.T) {
	h := newHarness(t)
	host := h.hostJoin("r1", map[string]any{})
	h.patch(host, "guest:patch", "r1", map[string]any{"diagramName": "x"}, nil)

	if got := errorCode(host); got != "invalid_guest_patch" {
		t.Fatalf("code = %q, want invalid_guest_patch", got)
	}
}

func TestPatchForAnotherRoomIsRefused(t *testing.T) {
	h := newHarness(t)
	host := h.hostJoin("r1", map[string]any{})
	h.patch(host, "host:patch", "other-room", map[string]any{"diagramName": "x"}, nil)

	if got := errorCode(host); got != "invalid_host_patch" {
		t.Fatalf("code = %q, want invalid_host_patch", got)
	}
}

func TestCanonicalSortsKeysLikeJavaScript(t *testing.T) {
	// JavaScript compares UTF-16 code units, so a surrogate pair sorts below
	// U+E000 even though its UTF-8 bytes sort above.
	keys := []string{"\uE000", "\U0001F600", "a"}
	sort.Slice(keys, func(i, j int) bool { return lessUTF16(keys[i], keys[j]) })

	// UTF-16: 'a' (0x61) < the pair's lead unit (0xD83D) < U+E000.
	// UTF-8 bytes would order U+E000 (0xEE...) before the pair (0xF0...).
	want := []string{"a", "\U0001F600", "\uE000"}
	for i := range want {
		if keys[i] != want[i] {
			t.Fatalf("order = %q, want %q", keys, want)
		}
	}
}
