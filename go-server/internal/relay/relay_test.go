package relay

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/clarkjoao/structura/go-server/internal/protocol"
	"github.com/clarkjoao/structura/go-server/internal/store"
)

// ── Harness ─────────────────────────────────────────────────────────────────

type message map[string]any

func (m message) str(key string) string { s, _ := m[key].(string); return s }
func (m message) num(key string) int64  { f, _ := m[key].(float64); return int64(f) }

// fakeClient is an in-process socket: it records what the relay sends.
type fakeClient struct {
	t        *testing.T
	user     protocol.User
	handlers Handlers
	mu       sync.Mutex
	received []message
	closed   *[2]any
	queued   atomic.Int64
	changed  chan struct{}
}

func newClient(t *testing.T, name string) *fakeClient {
	return &fakeClient{
		t:       t,
		user:    protocol.User{ID: fmt.Sprintf("%s-%d", name, time.Now().UnixNano()), Name: name, Color: "#123"},
		changed: make(chan struct{}, 1),
	}
}

func (c *fakeClient) attach(r *Relay) *fakeClient {
	c.handlers = r.Connect(c)
	return c
}

func (c *fakeClient) Send(frame []byte) {
	var m message
	if err := json.Unmarshal(frame, &m); err != nil {
		c.t.Errorf("relay sent a non-object frame: %s", frame)
		return
	}
	c.mu.Lock()
	c.received = append(c.received, m)
	c.mu.Unlock()
	select {
	case c.changed <- struct{}{}:
	default:
	}
}

func (c *fakeClient) Close(code int, reason string) {
	c.mu.Lock()
	if c.closed != nil {
		c.mu.Unlock()
		return
	}
	c.closed = &[2]any{code, reason}
	c.mu.Unlock()
	// A real socket closes asynchronously.
	go c.handlers.OnClose()
}

func (c *fakeClient) Buffered() int { return int(c.queued.Load()) }

func (c *fakeClient) write(v any) {
	c.handlers.OnMessage(protocol.MustMarshal(v))
}

func (c *fakeClient) writeRaw(raw string) { c.handlers.OnMessage([]byte(raw)) }

func (c *fakeClient) drop() { c.Close(1006, "dropped") }

func (c *fakeClient) closedWith() (int, string, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.closed == nil {
		return 0, "", false
	}
	return c.closed[0].(int), c.closed[1].(string), true
}

func (c *fakeClient) all(kind string) []message {
	c.mu.Lock()
	defer c.mu.Unlock()
	var out []message
	for _, m := range c.received {
		if m.str("type") == kind {
			out = append(out, m)
		}
	}
	return out
}

// next waits for a message of a type that matches.
func (c *fakeClient) next(kind string, match func(message) bool) message {
	c.t.Helper()
	deadline := time.After(5 * time.Second)
	for {
		for _, m := range c.all(kind) {
			if match == nil || match(m) {
				return m
			}
		}
		select {
		case <-c.changed:
		case <-time.After(10 * time.Millisecond):
		case <-deadline:
			c.t.Fatalf("%s: timed out waiting for %s", c.user.Name, kind)
		}
	}
}

func (c *fakeClient) entries() []int64 {
	var out []int64
	for _, m := range c.all("entry") {
		out = append(out, m.num("version"))
	}
	return out
}

var seedState = []byte(`{"doc":{"diagramId":"d1","diagramName":"Payments","level":"context"},"entities":{"components":{"c1":{"id":"c1","name":"API"},"c2":{"id":"c2","name":"DB"}},"connections":{},"flows":{},"iconLibrary":{},"nodeLayouts":{"c1":{"elementId":"c1","x":0,"y":0},"c2":{"elementId":"c2","x":300,"y":0}},"edgeLayouts":{},"versions":{}}}`)

var fast = Options{
	HostGrace:      400 * time.Millisecond,
	HostLease:      100 * time.Millisecond,
	HostLeaseRenew: 30 * time.Millisecond,
	ReaperInterval: 20 * time.Millisecond,
	CursorFlush:    20 * time.Millisecond,
	RoomCheck:      50 * time.Millisecond,
	Log:            func(string, ...any) {},
}

var roomCounter atomic.Int64

func nextRoomID() string {
	return fmt.Sprintf("relay-%d-%d-%d", os.Getpid(), time.Now().UnixNano(), roomCounter.Add(1))
}

type storeFactory struct {
	name string
	make func(t *testing.T) store.Shared
}

func storeFactories() []storeFactory {
	out := []storeFactory{{"memory", func(t *testing.T) store.Shared { return store.NewMemory(nil) }}}
	if url := os.Getenv("REDIS_URL"); url != "" {
		out = append(out, storeFactory{"redis", func(t *testing.T) store.Shared {
			s, err := store.NewRedis(url, store.RedisOptions{Namespace: fmt.Sprintf("gorelay-%d:", os.Getpid())})
			if err != nil {
				t.Fatal(err)
			}
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			if err := s.Ready(ctx); err != nil {
				t.Fatal(err)
			}
			t.Cleanup(func() { _ = s.Close() })
			return s
		}})
	}
	return out
}

func newRelay(t *testing.T, s store.Shared, opt Options) *Relay {
	if opt.HostGrace == 0 {
		opt = fast
	}
	r := New(s, opt)
	t.Cleanup(r.Stop)
	return r
}

func hostRoom(t *testing.T, r *Relay, roomID string) (*fakeClient, string) {
	t.Helper()
	host := newClient(t, "host").attach(r)
	text := string(seedState)
	chunks := protocol.ChunkString(text, protocol.ChunkChars)
	host.write(map[string]any{"type": "create", "protocol": 3, "roomId": roomID, "user": host.user, "seedChars": protocol.UTF16Len(text), "seedChunks": len(chunks)})
	created := host.next("created", nil)
	for i, data := range chunks {
		host.write(map[string]any{"type": "seed:chunk", "index": i, "data": data})
	}
	host.write(map[string]any{"type": "seed:commit"})
	host.next("joined", nil)
	return host, created.str("hostToken")
}

func joinRoom(t *testing.T, r *Relay, roomID, name string, extra map[string]any) *fakeClient {
	t.Helper()
	c := newClient(t, name).attach(r)
	msg := map[string]any{"type": "join", "protocol": 3, "roomId": roomID, "user": c.user}
	for k, v := range extra {
		msg[k] = v
	}
	c.write(msg)
	return c
}

func ready(t *testing.T, c *fakeClient) message {
	t.Helper()
	joined := c.next("joined", nil)
	if _, ok := joined["catchup"]; !ok {
		c.next("snapshot:end", nil)
	}
	return joined
}

func patchMsg(opID string, base int64, patch string) map[string]any {
	return map[string]any{"type": "patch", "opId": opID, "baseVersion": base, "patch": json.RawMessage(patch)}
}

func snapshotState(c *fakeClient) string {
	var b strings.Builder
	for _, m := range c.all("snapshot:chunk") {
		b.WriteString(m.str("data"))
	}
	return b.String()
}

// ── Tests ───────────────────────────────────────────────────────────────────

func TestRelay(t *testing.T) {
	for _, f := range storeFactories() {
		t.Run(f.name, func(t *testing.T) {
			setup := func(t *testing.T) (store.Shared, *Relay) {
				s := f.make(t)
				return s, newRelay(t, s, fast)
			}

			t.Run("seeds the room and returns a host credential", func(t *testing.T) {
				_, r := setup(t)
				roomID := nextRoomID()
				_, token := hostRoom(t, r, roomID)
				if len(token) < 20 {
					t.Fatalf("token %q", token)
				}
				guest := joinRoom(t, r, roomID, "guest", nil)
				ready(t, guest)
				state, ok := protocol.ParseState([]byte(snapshotState(guest)))
				want, _ := protocol.ParseState(seedState)
				if !ok || string(protocol.MustMarshal(state)) != string(protocol.MustMarshal(want)) {
					t.Fatalf("snapshot %s", snapshotState(guest))
				}
			})

			t.Run("refuses a diagram over the size limit with its size", func(t *testing.T) {
				_, r := setup(t)
				c := newClient(t, "host").attach(r)
				c.write(map[string]any{"type": "create", "protocol": 3, "roomId": nextRoomID(), "user": c.user, "seedChars": protocol.MaxSeedChars + 1, "seedChunks": 129})
				e := c.next("error", nil)
				if e.str("code") != "too_large" || e.num("size") != protocol.MaxSeedChars+1 || e.num("limit") != protocol.MaxSeedChars {
					t.Fatalf("error %v", e)
				}
			})

			t.Run("discards a room whose seed cannot be read", func(t *testing.T) {
				s, r := setup(t)
				roomID := nextRoomID()
				c := newClient(t, "host").attach(r)
				c.write(map[string]any{"type": "create", "protocol": 3, "roomId": roomID, "user": c.user, "seedChars": 5, "seedChunks": 1})
				c.next("created", nil)
				c.write(map[string]any{"type": "seed:chunk", "index": 0, "data": "{oops"})
				c.write(map[string]any{"type": "seed:commit"})
				if e := c.next("error", nil); e.str("code") != "invalid_seed" {
					t.Fatalf("error %v", e)
				}
				if meta, _ := s.GetMeta(context.Background(), roomID); meta != nil {
					t.Fatal("room kept")
				}
			})

			t.Run("answers an unknown room and an older protocol explicitly", func(t *testing.T) {
				_, r := setup(t)
				c := joinRoom(t, r, nextRoomID(), "guest", nil)
				if e := c.next("error", nil); e.str("code") != "room_unknown" {
					t.Fatalf("error %v", e)
				}
				old := newClient(t, "old").attach(r)
				old.write(map[string]any{"type": "join", "protocol": 2, "roomId": "r1", "user": old.user})
				if e := old.next("error", nil); e.str("code") != "protocol_mismatch" {
					t.Fatalf("error %v", e)
				}
				if code, _, ok := old.closedWith(); !ok || code != 1008 {
					t.Fatalf("not closed: %v", code)
				}
			})

			t.Run("refuses the participant over capacity", func(t *testing.T) {
				s := f.make(t)
				opt := fast
				opt.MaxParticipants = 2
				r := newRelay(t, s, opt)
				roomID := nextRoomID()
				hostRoom(t, r, roomID)
				ready(t, joinRoom(t, r, roomID, "a", nil))
				full := joinRoom(t, r, roomID, "b", nil)
				if e := full.next("error", nil); e.str("code") != "room_full" || e.num("limit") != 2 {
					t.Fatalf("error %v", e)
				}
			})

			t.Run("tells the others who joined and who left", func(t *testing.T) {
				_, r := setup(t)
				roomID := nextRoomID()
				host, _ := hostRoom(t, r, roomID)
				guest := joinRoom(t, r, roomID, "guest", nil)
				ready(t, guest)
				host.next("peer:joined", func(m message) bool { return m["participant"].(map[string]any)["clientId"] == guest.user.ID })
				guest.drop()
				left := host.next("peer:left", func(m message) bool { return m.str("clientId") == guest.user.ID })
				if left.num("participantCount") != 1 {
					t.Fatalf("count %v", left)
				}
			})

			t.Run("orders edits, confirms them, and sends them to everyone", func(t *testing.T) {
				_, r := setup(t)
				roomID := nextRoomID()
				host, _ := hostRoom(t, r, roomID)
				guest := joinRoom(t, r, roomID, "guest", nil)
				ready(t, guest)
				guest.write(patchMsg("g1", 0, `{"entities":{"components":{"c1":{"set":{"name":"Gateway"}}}}}`))
				host.write(patchMsg("h1", 0, `{"entities":{"components":{"c2":{"set":{"name":"Store"}}}}}`))
				if ack := guest.next("ack", nil); !ack["applied"].(bool) {
					t.Fatalf("ack %v", ack)
				}
				host.next("entry", func(m message) bool { return m.num("version") == 2 })
				guest.next("entry", func(m message) bool { return m.num("version") == 2 })
				if fmt.Sprint(host.entries()) != "[1 2]" || fmt.Sprint(guest.entries()) != "[1 2]" {
					t.Fatalf("host %v guest %v", host.entries(), guest.entries())
				}
			})

			t.Run("acknowledges a change that changes nothing without spending a version", func(t *testing.T) {
				_, r := setup(t)
				roomID := nextRoomID()
				host, _ := hostRoom(t, r, roomID)
				host.write(patchMsg("h1", 0, `{"doc":{"diagramName":"Payments"}}`))
				ack := host.next("ack", nil)
				if ack["applied"].(bool) || ack.num("version") != 0 {
					t.Fatalf("ack %v", ack)
				}
			})

			t.Run("rate-limits a flooding participant", func(t *testing.T) {
				s := f.make(t)
				opt := fast
				opt.PatchRate = Rate{Rate: 1, Burst: 2}
				r := newRelay(t, s, opt)
				roomID := nextRoomID()
				host, _ := hostRoom(t, r, roomID)
				for i := 0; i < 5; i++ {
					host.write(patchMsg(fmt.Sprintf("h%d", i), 0, fmt.Sprintf(`{"doc":{"description":"%d"}}`, i)))
				}
				host.next("error", func(m message) bool { return m.str("code") == "rate_limited" })
				applied := 0
				for _, ack := range host.all("ack") {
					if ack["applied"].(bool) {
						applied++
					}
				}
				if applied != 2 {
					t.Fatalf("applied %d", applied)
				}
			})

			t.Run("rejects a frame over the size cap without dropping the socket", func(t *testing.T) {
				_, r := setup(t)
				c := newClient(t, "x").attach(r)
				c.writeRaw(`{"type":"ping","pad":"` + strings.Repeat("x", protocol.MaxFrameChars) + `"}`)
				if e := c.next("error", nil); e.str("code") != "too_large" {
					t.Fatalf("error %v", e)
				}
				c.write(map[string]any{"type": "ping"})
				c.next("pong", nil)
			})

			t.Run("hands a joiner during a burst exactly the room's state, then only newer entries", func(t *testing.T) {
				_, r := setup(t)
				roomID := nextRoomID()
				host, _ := hostRoom(t, r, roomID)
				done := make(chan struct{})
				go func() {
					defer close(done)
					for i := 0; i < 40; i++ {
						host.write(patchMsg(fmt.Sprintf("h%d", i), int64(i), fmt.Sprintf(`{"entities":{"nodeLayouts":{"c1":{"set":{"x":%d}}}}}`, i+1)))
					}
				}()
				guest := joinRoom(t, r, roomID, "guest", nil)
				joined := ready(t, guest)
				<-done
				guest.next("entry", func(m message) bool { return m.num("version") == 40 })
				base := joined.num("version")
				want := base + 1
				for _, v := range guest.entries() {
					if v != want {
						t.Fatalf("entries after %d: %v", base, guest.entries())
					}
					want++
				}
			})

			t.Run("resumes: empty catch-up, missed entries, other incarnation", func(t *testing.T) {
				_, r := setup(t)
				roomID := nextRoomID()
				host, _ := hostRoom(t, r, roomID)
				first := joinRoom(t, r, roomID, "guest", nil)
				epoch := ready(t, first).str("epoch")
				same := joinRoom(t, r, roomID, "same", map[string]any{"resumeFrom": 0, "resumeEpoch": epoch})
				if j := same.next("joined", nil); j["catchup"] == nil || len(j["catchup"].([]any)) != 0 {
					t.Fatalf("joined %v", j)
				}
				host.write(patchMsg("h1", 0, `{"doc":{"description":"a"}}`))
				host.write(patchMsg("h2", 1, `{"doc":{"description":"b"}}`))
				host.next("entry", func(m message) bool { return m.num("version") == 2 })
				missed := joinRoom(t, r, roomID, "missed", map[string]any{"resumeFrom": 0, "resumeEpoch": epoch})
				j := missed.next("joined", nil)
				if c, _ := j["catchup"].([]any); len(c) != 2 || j.num("version") != 2 {
					t.Fatalf("joined %v", j)
				}
				other := joinRoom(t, r, roomID, "other", map[string]any{"resumeFrom": 0, "resumeEpoch": "older"})
				if j := other.next("joined", nil); j["catchup"] != nil {
					t.Fatalf("resumed into another incarnation: %v", j)
				}
				other.next("snapshot:end", nil)
			})

			t.Run("host credential: guests cannot claim it or close the session", func(t *testing.T) {
				_, r := setup(t)
				roomID := nextRoomID()
				hostRoom(t, r, roomID)
				fake := joinRoom(t, r, roomID, "fake", map[string]any{"hostToken": "nope"})
				if e := fake.next("error", nil); e.str("code") != "unauthorized" {
					t.Fatalf("error %v", e)
				}
				guest := joinRoom(t, r, roomID, "guest", nil)
				ready(t, guest)
				guest.write(map[string]any{"type": "close"})
				if e := guest.next("error", nil); e.str("code") != "unauthorized" {
					t.Fatalf("error %v", e)
				}
				host2 := newClient(t, "again").attach(r)
				host2.write(map[string]any{"type": "create", "protocol": 3, "roomId": roomID, "user": host2.user, "seedChars": 2, "seedChunks": 1})
				if e := host2.next("error", nil); e.str("code") != "room_exists" {
					t.Fatalf("error %v", e)
				}
			})

			t.Run("keeps the room working while the host is away, then closes it", func(t *testing.T) {
				_, r := setup(t)
				roomID := nextRoomID()
				host, _ := hostRoom(t, r, roomID)
				guest := joinRoom(t, r, roomID, "guest", nil)
				ready(t, guest)
				host.drop()
				guest.next("host:status", func(m message) bool { return m["online"] == false })
				guest.write(patchMsg("g1", 0, `{"doc":{"description":"while away"}}`))
				if ack := guest.next("ack", nil); !ack["applied"].(bool) {
					t.Fatalf("ack %v", ack)
				}
				closed := guest.next("session:closed", nil)
				if closed.str("reason") != "host_timeout" {
					t.Fatalf("closed %v", closed)
				}
			})

			t.Run("the host coming back is told nothing was lost and guests see it online", func(t *testing.T) {
				_, r := setup(t)
				roomID := nextRoomID()
				host, token := hostRoom(t, r, roomID)
				guest := joinRoom(t, r, roomID, "guest", nil)
				ready(t, guest)
				host.drop()
				guest.next("host:status", func(m message) bool { return m["online"] == false })
				back := newClient(t, "host").attach(r)
				back.user = host.user
				back.write(map[string]any{"type": "join", "protocol": 3, "roomId": roomID, "user": host.user, "hostToken": token})
				if j := back.next("joined", nil); j.str("role") != "host" {
					t.Fatalf("joined %v", j)
				}
				guest.next("host:status", func(m message) bool { return m["online"] == true })
			})

			t.Run("ends the session for everyone when the host closes it", func(t *testing.T) {
				_, r := setup(t)
				roomID := nextRoomID()
				host, _ := hostRoom(t, r, roomID)
				guest := joinRoom(t, r, roomID, "guest", nil)
				ready(t, guest)
				host.write(map[string]any{"type": "close"})
				if c := guest.next("session:closed", nil); c.str("reason") != "host_closed" {
					t.Fatalf("closed %v", c)
				}
				late := joinRoom(t, r, roomID, "late", nil)
				if e := late.next("error", nil); e.str("code") != "session_closed" {
					t.Fatalf("error %v", e)
				}
			})

			t.Run("grants a lock to one participant and tells the others", func(t *testing.T) {
				_, r := setup(t)
				roomID := nextRoomID()
				host, _ := hostRoom(t, r, roomID)
				guest := joinRoom(t, r, roomID, "guest", nil)
				ready(t, guest)
				host.write(map[string]any{"type": "lock", "action": "acquire", "entityId": "c1"})
				if res := host.next("lock:result", nil); !res["granted"].(bool) {
					t.Fatalf("result %v", res)
				}
				guest.next("lock", func(m message) bool { return m.str("holder") == host.user.ID })
				guest.write(map[string]any{"type": "lock", "action": "acquire", "entityId": "c1"})
				res := guest.next("lock:result", nil)
				if res["granted"].(bool) || res.str("holder") != host.user.ID {
					t.Fatalf("result %v", res)
				}
				// The holder's position wins; the other's move of a guarded field is dropped.
				guest.write(patchMsg("g1", 0, `{"entities":{"nodeLayouts":{"c1":{"set":{"x":999}}}}}`))
				if ack := guest.next("ack", nil); ack["applied"].(bool) {
					t.Fatalf("ack %v", ack)
				}
				host.drop()
				guest.next("lock", func(m message) bool { return m["holder"] == nil && m.str("entityId") == "c1" })
			})

			t.Run("takes, renews and frees a multi-selection's locks in one message each", func(t *testing.T) {
				_, r := setup(t)
				roomID := nextRoomID()
				host, _ := hostRoom(t, r, roomID)
				guest := joinRoom(t, r, roomID, "guest", nil)
				ready(t, guest)
				ids := []string{"a", "b", "c", "d"}
				host.write(map[string]any{"type": "lock", "action": "acquire", "entityIds": ids})
				for _, id := range ids {
					id := id
					guest.next("lock", func(m message) bool { return m.str("entityId") == id && m.str("holder") == host.user.ID })
				}
				before := len(host.all("lock:result"))
				host.write(map[string]any{"type": "lock", "action": "renew", "entityIds": ids})
				host.write(map[string]any{"type": "lock", "action": "release", "entityIds": ids})
				for _, id := range ids {
					id := id
					guest.next("lock", func(m message) bool { return m.str("entityId") == id && m["holder"] == nil })
				}
				if after := len(host.all("lock:result")); after != before {
					t.Fatalf("a successful renew answered: %d → %d", before, after)
				}
			})

			t.Run("coalesces cursors and drops them for a backed-up socket", func(t *testing.T) {
				_, r := setup(t)
				roomID := nextRoomID()
				host, _ := hostRoom(t, r, roomID)
				guest := joinRoom(t, r, roomID, "guest", nil)
				ready(t, guest)
				for i := 0; i < 5; i++ {
					host.write(map[string]any{"type": "cursor", "cursor": map[string]any{"x": i, "y": i}, "activeElementId": nil})
				}
				// A flush may land mid-burst; each batch still carries one entry per participant,
				// and the last one ends where the cursor stopped.
				guest.next("cursors", func(m message) bool {
					entries := m["entries"].([]any)
					return entries[len(entries)-1].(map[string]any)["cursor"].(map[string]any)["x"].(float64) == 4
				})
				for _, m := range guest.all("cursors") {
					if entries := m["entries"].([]any); len(entries) != 1 {
						t.Fatalf("cursors not coalesced: %v", m)
					}
				}
				guest.queued.Store(2 * 1024 * 1024)
				count := len(guest.all("cursors"))
				host.write(map[string]any{"type": "cursor", "cursor": map[string]any{"x": 9, "y": 9}, "activeElementId": "c1"})
				time.Sleep(120 * time.Millisecond)
				if len(guest.all("cursors")) != count {
					t.Fatal("cursor sent to a backed-up socket")
				}
			})

			t.Run("tells everyone a lost room is gone, and the host brings it back", func(t *testing.T) {
				s, r := setup(t)
				roomID := nextRoomID()
				host, _ := hostRoom(t, r, roomID)
				guest := joinRoom(t, r, roomID, "guest", nil)
				ready(t, guest)
				_ = s.DiscardRoom(context.Background(), roomID)
				deadline := time.Now().Add(3 * time.Second)
				for {
					_, reasonG, okG := guest.closedWith()
					_, reasonH, okH := host.closedWith()
					if okG && okH && reasonG == "room_lost" && reasonH == "room_lost" {
						break
					}
					if time.Now().After(deadline) {
						t.Fatal("sockets not told")
					}
					time.Sleep(20 * time.Millisecond)
				}
			})

			t.Run("participants on different relays see each other's edits in one order", func(t *testing.T) {
				s, r := setup(t)
				var other *Relay
				if f.name == "memory" {
					other = newRelay(t, s, fast)
				} else {
					other = newRelay(t, f.make(t), fast)
				}
				roomID := nextRoomID()
				host, _ := hostRoom(t, r, roomID)
				guest := joinRoom(t, other, roomID, "guest", nil)
				ready(t, guest)
				for i := 0; i < 10; i++ {
					host.write(patchMsg(fmt.Sprintf("h%d", i), 0, fmt.Sprintf(`{"entities":{"nodeLayouts":{"c1":{"set":{"x":%d}}}}}`, i+1)))
					guest.write(patchMsg(fmt.Sprintf("g%d", i), 0, fmt.Sprintf(`{"entities":{"nodeLayouts":{"c2":{"set":{"y":%d}}}}}`, i+1)))
				}
				host.next("entry", func(m message) bool { return m.num("version") == 20 })
				guest.next("entry", func(m message) bool { return m.num("version") == 20 })
				if fmt.Sprint(host.entries()) != fmt.Sprint(guest.entries()) {
					t.Fatalf("host %v guest %v", host.entries(), guest.entries())
				}
			})
		})
	}
}
