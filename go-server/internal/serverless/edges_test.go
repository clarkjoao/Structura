package serverless

import (
	"bytes"
	"context"
	"encoding/json"
	"log"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/clarkjoao/structura/go-server/internal/protocol"
	"github.com/clarkjoao/structura/go-server/internal/relay"
	"github.com/clarkjoao/structura/go-server/internal/store"
)

func errorCodes(r *rig, connID string) []string {
	var out []string
	for _, m := range r.g.all(connID, "error") {
		out = append(out, m["code"].(string))
	}
	return out
}

func TestHandlersRefuseWhatIsOutOfTurn(t *testing.T) {
	ctx := context.Background()
	r := newRig(t, false, Options{MaxParticipants: 2})

	c := r.connect("c")
	if err := r.h.Message(ctx, c.id, []byte(strings.Repeat("x", protocol.MaxFrameChars+1))); err != nil {
		t.Fatal(err)
	}
	_ = r.h.Message(ctx, c.id, []byte(`{"type":"nope"}`))
	c.to(r.h, map[string]any{"type": "pong"})
	c.to(r.h, map[string]any{"type": "ping"})
	c.to(r.h, map[string]any{"type": "seed:chunk", "index": 0, "data": "x"})
	c.to(r.h, map[string]any{"type": "seed:commit"})
	c.to(r.h, map[string]any{"type": "patch", "opId": "o", "baseVersion": 0, "patch": map[string]any{}})
	c.to(r.h, map[string]any{"type": "lock", "action": "acquire", "entityId": "c1"})
	c.to(r.h, map[string]any{"type": "cursor", "cursor": nil, "activeElementId": nil})
	c.to(r.h, map[string]any{"type": "close"})
	want := []string{protocol.ErrTooLarge, protocol.ErrInvalidMessage, protocol.ErrNotJoined, protocol.ErrNotJoined, protocol.ErrNotJoined, protocol.ErrNotJoined, protocol.ErrUnauthorized}
	if got := errorCodes(r, c.id); strings.Join(got, ",") != strings.Join(want, ",") {
		t.Errorf("codes %v, want %v", got, want)
	}
	if len(r.g.all(c.id, "pong")) != 1 {
		t.Error("no pong")
	}

	// Creating.
	roomID := uniq("room")
	big := map[string]any{"type": "create", "protocol": 3, "roomId": roomID, "user": c.user, "seedChars": protocol.MaxSeedChars + 1, "seedChunks": 1}
	c.to(r.h, big)
	if got := errorCodes(r, c.id); got[len(got)-1] != protocol.ErrTooLarge {
		t.Errorf("too large: %v", got)
	}
	create := map[string]any{"type": "create", "protocol": 3, "roomId": roomID, "user": c.user, "seedChars": len(seed), "seedChunks": 1}
	c.to(r.h, create)
	c.to(r.h, create)
	c.to(r.h, map[string]any{"type": "seed:chunk", "index": 5, "data": "x"})
	c.to(r.h, map[string]any{"type": "join", "protocol": 3, "roomId": roomID, "user": c.user})
	got := errorCodes(r, c.id)
	if strings.Join(got[len(got)-3:], ",") != strings.Join([]string{protocol.ErrAlreadyJoined, protocol.ErrInvalidSeed, protocol.ErrAlreadyJoined}, ",") {
		t.Errorf("seeding: %v", got)
	}
	other := r.connect("other")
	other.to(r.h, create)
	if got := errorCodes(r, other.id); len(got) != 1 || got[0] != protocol.ErrRoomExists {
		t.Errorf("room exists: %v", got)
	}

	// Joining a room that is not ready, unknown, with a wrong credential, closed, or full.
	early := r.joinRoom(r.h, roomID, "early", nil)
	unknown := r.joinRoom(r.h, uniq("none"), "unknown", nil)
	c.to(r.h, map[string]any{"type": "seed:chunk", "index": 0, "data": seed})
	c.to(r.h, map[string]any{"type": "seed:commit"})
	thief := r.joinRoom(r.h, roomID, "thief", map[string]any{"hostToken": "not it"})
	guest := r.joinRoom(r.h, roomID, "guest", nil)
	r.g.wait(t, guest.id, "joined", nil)
	full := r.joinRoom(r.h, roomID, "full", nil)
	for conn, code := range map[string]string{early.id: protocol.ErrNotReady, unknown.id: protocol.ErrRoomUnknown, thief.id: protocol.ErrUnauthorized, full.id: protocol.ErrRoomFull} {
		if got := errorCodes(r, conn); len(got) != 1 || got[0] != code {
			t.Errorf("%s: %v", code, got)
		}
	}
	guest.to(r.h, map[string]any{"type": "close"})
	if got := errorCodes(r, guest.id); len(got) != 1 || got[0] != protocol.ErrUnauthorized {
		t.Errorf("guest close: %v", got)
	}
	_, _ = r.mem.CloseRoom(ctx, roomID, protocol.ReasonHostClosed)
	late := r.joinRoom(r.h, roomID, "late", nil)
	if got := errorCodes(r, late.id); len(got) != 1 || got[0] != protocol.ErrSessionClosed {
		t.Errorf("closed: %v", got)
	}

	// An older protocol is refused and the socket closed, on create and on join.
	for _, kind := range []string{"create", "join"} {
		old := r.connect("old")
		old.to(r.h, map[string]any{"type": kind, "protocol": 2, "roomId": uniq("r"), "user": old.user, "seedChars": 1, "seedChunks": 1})
		if got := errorCodes(r, old.id); len(got) != 1 || got[0] != protocol.ErrProtocolMismatch {
			t.Errorf("%s v2: %v", kind, got)
		}
	}

	// A socket with no record may still create (its $connect went to a store that forgot it).
	fresh := &rclient{r: r, id: uniq("conn"), user: protocol.User{ID: uniq("f"), Name: "f", Color: "#000"}}
	fresh.to(r.h, map[string]any{"type": "create", "protocol": 3, "roomId": uniq("room"), "user": fresh.user, "seedChars": 1, "seedChunks": 1})
	r.g.wait(t, fresh.id, "created", nil)
}

func TestHandlersRateLimit(t *testing.T) {
	r := newRig(t, false, Options{
		PatchRate:  relay.Rate{Rate: 0.001, Burst: 1},
		LockRate:   relay.Rate{Rate: 0.001, Burst: 1},
		CursorRate: relay.Rate{Rate: 0.001, Burst: 1},
	})
	roomID := uniq("room")
	r.hostRoom(r.plain, roomID)
	guest := r.joinRoom(r.plain, roomID, "guest", nil)
	r.g.wait(t, guest.id, "joined", nil)
	other := r.joinRoom(r.plain, roomID, "other", nil)
	r.g.wait(t, other.id, "joined", nil)
	for i := 0; i < 2; i++ {
		guest.to(r.h, map[string]any{"type": "patch", "opId": "not-a-counter", "baseVersion": 0, "patch": map[string]any{"doc": map[string]any{"level": "x"}}})
		guest.to(r.h, map[string]any{"type": "lock", "action": "acquire", "entityId": "c1"})
		guest.to(r.h, map[string]any{"type": "cursor", "cursor": map[string]any{"x": i, "y": 0}, "activeElementId": nil})
	}
	if got := errorCodes(r, guest.id); strings.Join(got, ",") != protocol.ErrRateLimited+","+protocol.ErrRateLimited {
		t.Errorf("codes %v", got)
	}
	if n := len(r.g.all(other.id, "cursors")); n != 1 {
		t.Errorf("%d cursor frames", n)
	}

	// Buckets of sockets quiet for long are forgotten.
	r.h.mu.Lock()
	r.h.pruned = time.Now().Add(-time.Hour)
	for _, b := range r.h.buckets {
		b.seen = time.Now().Add(-time.Hour)
	}
	r.h.mu.Unlock()
	r.h.bucketsFor("someone")
	r.h.mu.Lock()
	n := len(r.h.buckets)
	r.h.mu.Unlock()
	if n != 1 {
		t.Errorf("%d buckets kept", n)
	}
}

func TestHandlersLeaving(t *testing.T) {
	ctx := context.Background()
	r := newRig(t, false, Options{})
	// A socket that never joined.
	idle := r.connect("idle")
	if err := r.h.Disconnect(ctx, idle.id); err != nil {
		t.Fatal(err)
	}

	// A client with two sockets: closing one keeps it in the room.
	roomID := uniq("room")
	r.hostRoom(r.plain, roomID)
	first := r.joinRoom(r.plain, roomID, "twice", nil)
	r.g.wait(t, first.id, "joined", nil)
	second := &rclient{r: r, id: uniq("conn"), user: first.user}
	_ = r.plain.Connect(ctx, second.id)
	second.to(r.plain, map[string]any{"type": "join", "protocol": 3, "roomId": roomID, "user": second.user})
	r.g.wait(t, second.id, "joined", nil)
	if joined := r.g.all(second.id, "joined")[0]; len(joined["participants"].([]any)) != 2 {
		t.Errorf("participants %v", joined["participants"])
	}
	if err := r.h.Disconnect(ctx, first.id); err != nil {
		t.Fatal(err)
	}
	for _, m := range r.g.all(second.id, "peer:left") {
		t.Errorf("told the room the client left: %v", m)
	}
}

func TestHandlersRoomGoingAwayMidway(t *testing.T) {
	ctx := context.Background()
	r := newRig(t, false, Options{})
	roomID := uniq("room")
	r.hostRoom(r.plain, roomID)

	// The room closes while a guest's snapshot is read.
	r.plan.Only(func(name string) bool { return name == "rooms.ReadSnapshot" })
	r.plan.Before(func(string) { _, _ = r.mem.CloseRoom(ctx, roomID, protocol.ReasonHostClosed) })
	guest := r.joinRoom(r.h, roomID, "guest", nil)
	r.plan.Before(nil)
	r.plan.Only(nil)
	if got := errorCodes(r, guest.id); len(got) != 1 || got[0] != protocol.ErrSessionClosed {
		t.Errorf("codes %v", got)
	}

	// A ping finds the room gone from the store: everyone reconnects.
	roomID = uniq("room")
	host, _ := r.hostRoom(r.plain, roomID)
	_ = r.mem.DiscardRoom(ctx, roomID)
	host.to(r.h, map[string]any{"type": "ping"})
	r.g.mu.Lock()
	closed := r.g.closed[host.id]
	r.g.mu.Unlock()
	if !closed || !strings.Contains(r.logs.all(), "room lost from storage") {
		t.Error("the host was not sent back to reconnect")
	}
}

// deliveryRig is a room with a host and the given guests, at version `version`, every guest
// marked as sent nothing yet.
func deliveryRig(t *testing.T, version int, names ...string) (*rig, string, *rclient, []*rclient) {
	ctx := context.Background()
	r := newRig(t, false, Options{PumpBudget: 50 * time.Millisecond, HandoverBudget: 100 * time.Millisecond})
	roomID := uniq("room")
	host, _ := r.hostRoom(r.plain, roomID)
	var guests []*rclient
	for _, name := range names {
		g := r.joinRoom(r.plain, roomID, name, nil)
		r.g.wait(t, g.id, "joined", nil)
		guests = append(guests, g)
	}
	for v := 1; v <= version; v++ {
		host.to(r.plain, map[string]any{"type": "patch", "opId": "h:1:" + strings.Repeat("1", v), "baseVersion": v - 1,
			"patch": map[string]any{"doc": map[string]any{"level": strings.Repeat("l", v)}}})
	}
	reset := map[string]int64{}
	for _, g := range guests {
		reset[g.id] = 0
	}
	_ = r.reg.SetDelivered(ctx, roomID, reset)
	return r, roomID, host, guests
}

func (r *rig) isClosed(c *rclient) bool {
	r.g.mu.Lock()
	defer r.g.mu.Unlock()
	return r.g.closed[c.id]
}

func TestDeliveryReadsPerSocketWhenTheSharedReadFallsShort(t *testing.T) {
	ctx := context.Background()
	r, roomID, host, guests := deliveryRig(t, 2, "a", "b", "stale")
	a, b, stale := guests[0], guests[1], guests[2]
	_ = r.reg.SetDelivered(ctx, roomID, map[string]int64{b.id: 1})
	members, _ := r.reg.ListMembers(ctx, roomID)
	for _, m := range members {
		if m.ConnID == stale.id {
			m.Epoch = "earlier" // joined an earlier incarnation of the room
			_ = r.reg.PutMember(ctx, roomID, m)
		}
	}
	var mu sync.Mutex
	shared := true
	r.rooms.entries = func(_ string, from int64) ([]protocol.Entry, bool, bool) {
		mu.Lock()
		defer mu.Unlock()
		if shared {
			shared = false
			return nil, false, true // the read for everyone does not cover the span
		}
		if from == 1 {
			return nil, false, true // nor does b's own
		}
		return nil, false, false // a's own does
	}
	before := len(r.g.versions(a.id))
	host.to(r.h, map[string]any{"type": "ping"})
	r.rooms.entries = nil
	if v := r.g.versions(a.id)[before:]; len(v) != 2 || v[1] != 2 {
		t.Errorf("a got %v", v)
	}
	if !r.isClosed(b) || !r.isClosed(stale) {
		t.Errorf("b closed %v, stale closed %v", r.isClosed(b), r.isClosed(stale))
	}
}

func TestDeliverySkipsASocketWithNothingNewer(t *testing.T) {
	r, _, host, guests := deliveryRig(t, 1, "a")
	r.rooms.entries = func(_ string, from int64) ([]protocol.Entry, bool, bool) {
		if from == 0 {
			return []protocol.Entry{}, true, true
		}
		return nil, false, false
	}
	before := len(r.g.versions(guests[0].id))
	host.to(r.h, map[string]any{"type": "ping"})
	r.rooms.entries = nil
	if v := r.g.versions(guests[0].id)[before:]; len(v) != 0 {
		t.Errorf("sent %v", v)
	}
}

func TestDeliverySendsAnEntryTooLargeBackThroughTheSnapshot(t *testing.T) {
	r, _, host, guests := deliveryRig(t, 1, "a")
	r.g.mu.Lock()
	r.g.maxPost = 100
	r.g.mu.Unlock()
	host.to(r.h, map[string]any{"type": "ping"})
	if !r.isClosed(guests[0]) {
		t.Error("not sent back")
	}
}

func TestHandlersQueueLeftBehind(t *testing.T) {
	ctx := context.Background()
	r := newRig(t, true, Options{})
	roomID := uniq("room")
	host, _ := r.hostRoom(r.plain, roomID)
	q := r.h.rooms.(*faultySeqRooms).q
	_ = q.Enqueue(ctx, roomID, store.QueuedPatch{ConnID: host.id, ApplyInput: store.ApplyInput{
		Patch: protocol.Patch{Doc: map[string]json.RawMessage{"level": json.RawMessage(`"q"`)}}, SenderID: host.user.ID, SenderVersion: 1 << 40, OpID: "left",
	}})
	host.to(r.h, map[string]any{"type": "ping"})
	ack := r.g.wait(t, host.id, "ack", nil)
	if ack["opId"] != "left" || ack["applied"] != true {
		t.Errorf("ack %v", ack)
	}
}

func TestPackAndSnapshotFrames(t *testing.T) {
	h := New(store.NewMemory(nil), newMemRegistry(), nil, Options{Log: func(string, ...any) {}, MaxPayload: 1200, ChunkChars: 64 * 1024})
	i := h.begin(context.Background())
	frames := [][]byte{[]byte(`{"a":1}`), []byte(`{"b":2}`)}
	if out := i.pack(frames); len(out) != 2 {
		t.Errorf("unbatched pack %q", out)
	}
	h.opt.Batch = true
	if out := i.pack(nil); len(out) != 0 {
		t.Errorf("pack of nothing %q", out)
	}
	state := protocol.EmptyState()
	state.Doc["diagramName"] = json.RawMessage(`"` + strings.Repeat("x", 5000) + `"`)
	chunks := i.snapshotFrames(&store.Snapshot{Version: 1, State: state})
	for _, f := range chunks {
		if len(f) > 1200 {
			t.Fatalf("frame of %d bytes", len(f))
		}
	}
	if opSeq("no-colon") != -1 || opSeq("a:b:x") != -1 || opSeq("a:b:0") != -1 || opSeq("a:b:7") != 7 {
		t.Error("opSeq")
	}
}

func TestDefaultLogger(t *testing.T) {
	var logged bytes.Buffer
	log.SetOutput(&logged)
	defer log.SetOutput(os.Stderr)
	h := New(store.NewMemory(nil), newMemRegistry(), nil, Options{})
	h.opt.Log("hello %d", 1)
	if !strings.Contains(logged.String(), "hello 1") {
		t.Error("not the standard logger")
	}
}

func TestASocketFoundGoneLeavesTheRoom(t *testing.T) {
	r, roomID, host, guests := deliveryRig(t, 0, "a")
	r.g.mu.Lock()
	r.g.closed[guests[0].id] = true
	r.g.mu.Unlock()
	host.to(r.h, map[string]any{"type": "patch", "opId": "h:9:1", "baseVersion": 0, "patch": map[string]any{"doc": map[string]any{"level": "g"}}})
	members, _ := r.reg.ListMembers(context.Background(), roomID)
	if len(members) != 1 {
		t.Errorf("members %v", members)
	}
}

func TestAPatchLeftToTheWriteLeaseHolder(t *testing.T) {
	ctx := context.Background()
	r := newRig(t, true, Options{})
	roomID := uniq("room")
	host, _ := r.hostRoom(r.plain, roomID)
	if got, _ := r.reg.AcquireLease(ctx, roomID+"#w", "another invocation", time.Minute); !got {
		t.Fatal("lease")
	}
	host.to(r.h, map[string]any{"type": "patch", "opId": "h:1:1", "baseVersion": 0, "patch": map[string]any{"doc": map[string]any{"level": "x"}}})
	if acks := r.g.all(host.id, "ack"); len(acks) != 0 {
		t.Errorf("answered by an invocation without the lease: %v", acks)
	}
	if pending, _ := r.h.rooms.(*faultySeqRooms).q.QueuePending(ctx, roomID); !pending {
		t.Error("the patch left the queue")
	}
}
