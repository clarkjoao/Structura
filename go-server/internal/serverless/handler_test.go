package serverless

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"sort"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/clarkjoao/structura/go-server/internal/protocol"
	"github.com/clarkjoao/structura/go-server/internal/store"
)

// ── An in-memory registry and API Gateway, so the handlers run without infrastructure ──

type memRegistry struct {
	mu      sync.Mutex
	conns   map[string]ConnRecord
	seqs    map[string]int64
	members map[string]map[string]Member
	cursor  map[string]map[string]int64
	leases  map[string]struct {
		owner string
		exp   time.Time
	}
	host  map[string]int64
	rooms map[string]bool
}

func newMemRegistry() *memRegistry {
	return &memRegistry{
		conns: map[string]ConnRecord{}, seqs: map[string]int64{}, members: map[string]map[string]Member{},
		cursor: map[string]map[string]int64{}, host: map[string]int64{}, rooms: map[string]bool{},
		leases: map[string]struct {
			owner string
			exp   time.Time
		}{},
	}
}

func (r *memRegistry) GetConn(_ context.Context, id string) (*ConnRecord, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	rec, ok := r.conns[id]
	if !ok {
		return nil, nil
	}
	rec.Seq = -1
	if s, ok := r.seqs[id]; ok {
		rec.Seq = s
	}
	return &rec, nil
}
func (r *memRegistry) PutConn(_ context.Context, rec ConnRecord) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.conns[rec.ConnID] = rec
	return nil
}
func (r *memRegistry) DeleteConn(_ context.Context, id string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.conns, id)
	delete(r.seqs, id)
	return nil
}
func (r *memRegistry) AdvanceSeq(_ context.Context, id string, seq int64) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, ok := r.conns[id]; ok && r.seqs[id] < seq {
		r.seqs[id] = seq
	}
	return nil
}
func (r *memRegistry) PutMember(_ context.Context, room string, m Member) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.members[room] == nil {
		r.members[room] = map[string]Member{}
	}
	r.members[room][m.ConnID] = m
	return nil
}
func (r *memRegistry) SetDelivered(_ context.Context, room string, d map[string]int64) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.cursor[room] == nil {
		r.cursor[room] = map[string]int64{}
	}
	for k, v := range d {
		r.cursor[room][k] = v
	}
	return nil
}
func (r *memRegistry) DeleteMember(_ context.Context, room, id string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.members[room], id)
	delete(r.cursor[room], id)
	return nil
}
func (r *memRegistry) ListMembers(_ context.Context, room string) ([]Member, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	var out []Member
	for _, m := range r.members[room] {
		m.Delivered = r.cursor[room][m.ConnID]
		out = append(out, m)
	}
	return out, nil
}
func (r *memRegistry) AcquireLease(_ context.Context, room, owner string, ttl time.Duration) (bool, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	l, ok := r.leases[room]
	if ok && l.owner != owner && time.Now().Before(l.exp) {
		return false, nil
	}
	r.leases[room] = struct {
		owner string
		exp   time.Time
	}{owner, time.Now().Add(ttl)}
	return true, nil
}
func (r *memRegistry) ReleaseLease(_ context.Context, room, owner string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.leases[room].owner == owner {
		delete(r.leases, room)
	}
	return nil
}
func (r *memRegistry) SetHostOffline(_ context.Context, room string, since int64) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.host[room] = since
	return nil
}
func (r *memRegistry) ClearHostOffline(_ context.Context, room string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.host, room)
	return nil
}
func (r *memRegistry) HostOfflineSince(_ context.Context, room string) (int64, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.host[room], nil
}
func (r *memRegistry) AddRoom(_ context.Context, room string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.rooms[room] = true
	return nil
}
func (r *memRegistry) RemoveRoom(_ context.Context, room string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.rooms, room)
	delete(r.members, room)
	delete(r.cursor, room)
	delete(r.host, room)
	return nil
}
func (r *memRegistry) ListRooms(context.Context) ([]string, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	var out []string
	for room := range r.rooms {
		out = append(out, room)
	}
	return out, nil
}

// gateway records what each socket was sent and reports $disconnect like API Gateway.
type gateway struct {
	t        *testing.T
	h        *Handler
	mu       sync.Mutex
	received map[string][]map[string]any
	closed   map[string]bool
	posts    atomic.Int64
	maxPost  int
	// quiet leaves $disconnect to the test instead of reporting it.
	quiet bool
}

func (g *gateway) Post(_ context.Context, connID string, payload []byte) error {
	g.mu.Lock()
	defer g.mu.Unlock()
	if g.closed[connID] {
		return ErrGone
	}
	if g.maxPost > 0 && len(payload) > g.maxPost {
		return ErrTooLarge
	}
	g.posts.Add(1)
	var parsed any
	if err := json.Unmarshal(payload, &parsed); err != nil {
		g.t.Errorf("bad payload %s", payload)
		return nil
	}
	list, isList := parsed.([]any)
	if !isList {
		list = []any{parsed}
	}
	for _, item := range list {
		g.received[connID] = append(g.received[connID], item.(map[string]any))
	}
	return nil
}

func (g *gateway) Disconnect(_ context.Context, connID string) error {
	g.mu.Lock()
	already := g.closed[connID]
	g.closed[connID] = true
	g.mu.Unlock()
	if !already && !g.quiet {
		go func() { _ = g.h.Disconnect(context.Background(), connID) }()
	}
	return nil
}

func (g *gateway) Alive(_ context.Context, connID string) (bool, error) {
	g.mu.Lock()
	defer g.mu.Unlock()
	return !g.closed[connID], nil
}

func (g *gateway) all(connID, kind string) []map[string]any {
	g.mu.Lock()
	defer g.mu.Unlock()
	var out []map[string]any
	for _, m := range g.received[connID] {
		if m["type"] == kind {
			out = append(out, m)
		}
	}
	return out
}

func (g *gateway) wait(t *testing.T, connID, kind string, match func(map[string]any) bool) map[string]any {
	t.Helper()
	deadline := time.Now().Add(10 * time.Second)
	for time.Now().Before(deadline) {
		for _, m := range g.all(connID, kind) {
			if match == nil || match(m) {
				return m
			}
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatalf("%s: no %s", connID, kind)
	return nil
}

func (g *gateway) versions(connID string) []int64 {
	var out []int64
	for _, m := range g.all(connID, "entry") {
		out = append(out, int64(m["version"].(float64)))
	}
	return out
}

// ── Fixture ─────────────────────────────────────────────────────────────────

type backend struct {
	name string
	make func(t *testing.T) (store.Rooms, Registry)
}

func backends() []backend {
	out := []backend{{"memory", func(t *testing.T) (store.Rooms, Registry) { return store.NewMemory(nil), newMemRegistry() }}}
	if url := os.Getenv("REDIS_URL"); url != "" {
		out = append(out, backend{"redis", func(t *testing.T) (store.Rooms, Registry) {
			ns := fmt.Sprintf("slt-%d-%d:", os.Getpid(), time.Now().UnixNano())
			s, err := store.NewRedis(url, store.RedisOptions{Namespace: ns, Serverless: true})
			if err != nil {
				t.Fatal(err)
			}
			t.Cleanup(func() { _ = s.Close() })
			return s, NewRedisRegistry(s.Client(), ns)
		}})
	}
	if endpoint := os.Getenv("DYNAMODB_ENDPOINT"); endpoint != "" {
		out = append(out, backend{"dynamodb", func(t *testing.T) (store.Rooms, Registry) {
			ctx := context.Background()
			db, err := store.NewDynamoClient(ctx, endpoint)
			if err != nil {
				t.Fatal(err)
			}
			table := fmt.Sprintf("slt-%d", os.Getpid())
			if err := store.EnsureTable(ctx, db, table); err != nil {
				t.Fatal(err)
			}
			return store.NewDynamo(db, table, store.DynamoOptions{}), NewDynamoRegistry(db, table, store.NowMs)
		}})
	}
	return out
}

var counter atomic.Int64

func uniq(prefix string) string {
	return fmt.Sprintf("%s-%d-%d", prefix, time.Now().UnixNano(), counter.Add(1))
}

const seed = `{"doc":{"diagramId":"d1","diagramName":"Payments"},"entities":{"components":{"c1":{"id":"c1","name":"API"}},"connections":{},"flows":{},"iconLibrary":{},"nodeLayouts":{"c1":{"elementId":"c1","x":0,"y":0}},"edgeLayouts":{},"versions":{}}}`

type client struct {
	t    *testing.T
	g    *gateway
	id   string
	user protocol.User
}

func (c *client) send(v any) {
	c.t.Helper()
	if err := c.g.h.Message(context.Background(), c.id, protocol.MustMarshal(v)); err != nil {
		c.t.Fatal(err)
	}
}

func connect(t *testing.T, g *gateway, name string) *client {
	c := &client{t: t, g: g, id: uniq("conn"), user: protocol.User{ID: uniq(name), Name: name, Color: "#123"}}
	if err := g.h.Connect(context.Background(), c.id); err != nil {
		t.Fatal(err)
	}
	return c
}

func host(t *testing.T, g *gateway, roomID string) (*client, string) {
	c := connect(t, g, "host")
	c.send(map[string]any{"type": "create", "protocol": 3, "roomId": roomID, "user": c.user, "seedChars": len(seed), "seedChunks": 1})
	created := g.wait(t, c.id, "created", nil)
	c.send(map[string]any{"type": "seed:chunk", "index": 0, "data": seed})
	c.send(map[string]any{"type": "seed:commit"})
	g.wait(t, c.id, "joined", nil)
	return c, created["hostToken"].(string)
}

func join(t *testing.T, g *gateway, roomID, name string) *client {
	c := connect(t, g, name)
	c.send(map[string]any{"type": "join", "protocol": 3, "roomId": roomID, "user": c.user})
	g.wait(t, c.id, "joined", nil)
	return c
}

func setup(t *testing.T, b backend, opt Options) *gateway {
	rooms, reg := b.make(t)
	g := &gateway{t: t, received: map[string][]map[string]any{}, closed: map[string]bool{}}
	if opt.Log == nil {
		opt.Log = func(string, ...any) {}
	}
	opt.Batch = true
	g.h = New(rooms, reg, g, opt)
	return g
}

// ── Tests ───────────────────────────────────────────────────────────────────

func TestServerless(t *testing.T) {
	for _, b := range backends() {
		t.Run(b.name, func(t *testing.T) {
			t.Run("concurrent edits reach every socket once, in order, from its snapshot on", func(t *testing.T) {
				g := setup(t, b, Options{})
				roomID := uniq("room")
				h, _ := host(t, g, roomID)
				guests := []*client{join(t, g, roomID, "a"), join(t, g, roomID, "b")}
				var wg sync.WaitGroup
				const each = 15
				senders := append([]*client{h}, guests...)
				for s, c := range senders {
					wg.Add(1)
					go func(s int, c *client) {
						defer wg.Done()
						var inner sync.WaitGroup
						for i := 0; i < each; i++ {
							inner.Add(1)
							// Every frame is its own concurrent invocation, as with API Gateway.
							go func(i int) {
								defer inner.Done()
								c.send(map[string]any{"type": "patch", "opId": fmt.Sprintf("%s:%d", c.user.ID, i+1000*s), "baseVersion": 0,
									"patch": json.RawMessage(fmt.Sprintf(`{"entities":{"nodeLayouts":{"n%d":{"set":{"x":%d}}}}}`, s, i))})
							}(i)
						}
						inner.Wait()
					}(s, c)
				}
				// Someone joins in the middle of it.
				late := join(t, g, roomID, "late")
				wg.Wait()
				total := int64(each * len(senders))
				for _, c := range append(senders, late) {
					deadline := time.Now().Add(10 * time.Second)
					for {
						v := g.versions(c.id)
						if len(v) > 0 && v[len(v)-1] == total {
							break
						}
						// A joiner whose snapshot already holds everything gets no entry.
						if joined := g.all(c.id, "joined"); len(v) == 0 && len(joined) > 0 && int64(joined[0]["version"].(float64)) == total {
							break
						}
						if time.Now().After(deadline) {
							members, _ := g.h.reg.ListMembers(context.Background(), roomID)
							meta, _ := g.h.rooms.GetMeta(context.Background(), roomID)
							t.Fatalf("%s stopped at %v; room at %d; members %+v", c.user.Name, v, meta.Version, members)
						}
						time.Sleep(10 * time.Millisecond)
					}
				}
				for _, c := range senders {
					v := g.versions(c.id)
					for i, version := range v {
						if version != int64(i+1) {
							t.Fatalf("%s got %v", c.user.Name, v)
						}
					}
				}
				joined := g.all(late.id, "joined")[0]
				from := int64(joined["version"].(float64))
				v := g.versions(late.id)
				for i, version := range v {
					if version != from+int64(i)+1 {
						t.Fatalf("late joiner from %d got %v", from, v)
					}
				}
				// The snapshot came before any entry.
				g.mu.Lock()
				firstEntry, end := -1, -1
				for i, m := range g.received[late.id] {
					if m["type"] == "entry" && firstEntry < 0 {
						firstEntry = i
					}
					if m["type"] == "snapshot:end" {
						end = i
					}
				}
				g.mu.Unlock()
				if firstEntry >= 0 && firstEntry < end {
					t.Fatal("an entry reached the joiner before its snapshot")
				}
			})

			t.Run("a socket's patches apply in the order it sent them", func(t *testing.T) {
				g := setup(t, b, Options{})
				roomID := uniq("room")
				h, _ := host(t, g, roomID)
				var wg sync.WaitGroup
				// The first patch on a socket sets where its sequence starts.
				h.send(map[string]any{"type": "patch", "opId": h.user.ID + ":t:1", "baseVersion": 0, "patch": json.RawMessage(`{"doc":{"domain":"x"}}`)})
				for i := 2; i <= 9; i++ {
					wg.Add(1)
					go func(i int) {
						defer wg.Done()
						// Later ones arrive first.
						time.Sleep(time.Duration(10-i) * 15 * time.Millisecond)
						h.send(map[string]any{"type": "patch", "opId": fmt.Sprintf("%s:t:%d", h.user.ID, i), "baseVersion": 0,
							"patch": json.RawMessage(fmt.Sprintf(`{"entities":{"nodeLayouts":{"c1":{"set":{"x":%d}}}}}`, i))})
					}(i)
				}
				wg.Wait()
				g.wait(t, h.id, "entry", func(m map[string]any) bool { return m["version"].(float64) == 9 })
				var ops []string
				for _, m := range g.all(h.id, "entry") {
					ops = append(ops, m["opId"].(string)[strings.LastIndexByte(m["opId"].(string), ':')+1:])
				}
				if strings.Join(ops, ",") != "1,2,3,4,5,6,7,8,9" {
					t.Fatalf("applied in order %v", ops)
				}
			})

			t.Run("tells the others who left, and closes the room after the host's grace period", func(t *testing.T) {
				g := setup(t, b, Options{HostGrace: 300 * time.Millisecond})
				roomID := uniq("room")
				h, _ := host(t, g, roomID)
				guest := join(t, g, roomID, "guest")
				g.wait(t, h.id, "peer:joined", nil)
				_ = g.h.Disconnect(context.Background(), h.id)
				g.wait(t, guest.id, "peer:left", nil)
				g.wait(t, guest.id, "host:status", func(m map[string]any) bool { return m["online"] == false })
				time.Sleep(400 * time.Millisecond)
				if err := g.h.Reap(context.Background()); err != nil {
					t.Fatal(err)
				}
				closed := g.wait(t, guest.id, "session:closed", nil)
				if closed["reason"] != "host_timeout" {
					t.Fatalf("closed %v", closed)
				}
			})

			t.Run("the host coming back puts the room back online", func(t *testing.T) {
				g := setup(t, b, Options{})
				roomID := uniq("room")
				h, token := host(t, g, roomID)
				guest := join(t, g, roomID, "guest")
				_ = g.h.Disconnect(context.Background(), h.id)
				g.wait(t, guest.id, "host:status", func(m map[string]any) bool { return m["online"] == false })
				back := connect(t, g, "host")
				back.send(map[string]any{"type": "join", "protocol": 3, "roomId": roomID, "user": h.user, "hostToken": token})
				if j := g.wait(t, back.id, "joined", nil); j["role"] != "host" {
					t.Fatalf("joined %v", j)
				}
				g.wait(t, guest.id, "host:status", func(m map[string]any) bool { return m["online"] == true })
			})

			t.Run("locks: one holder, released when it leaves", func(t *testing.T) {
				g := setup(t, b, Options{})
				roomID := uniq("room")
				h, _ := host(t, g, roomID)
				guest := join(t, g, roomID, "guest")
				h.send(map[string]any{"type": "lock", "action": "acquire", "entityIds": []string{"c1", "c2"}})
				g.wait(t, guest.id, "lock", func(m map[string]any) bool { return m["entityId"] == "c2" && m["holder"] == h.user.ID })
				guest.send(map[string]any{"type": "lock", "action": "acquire", "entityId": "c1"})
				res := g.wait(t, guest.id, "lock:result", nil)
				if res["granted"] == true || res["holder"] != h.user.ID {
					t.Fatalf("result %v", res)
				}
				_ = g.h.Disconnect(context.Background(), h.id)
				g.wait(t, guest.id, "lock", func(m map[string]any) bool { return m["entityId"] == "c1" && m["holder"] == nil })
			})

			t.Run("a socket the store forgot is sent back through a fresh join", func(t *testing.T) {
				g := setup(t, b, Options{})
				roomID := uniq("room")
				host(t, g, roomID)
				guest := join(t, g, roomID, "guest")
				_ = g.h.reg.DeleteConn(context.Background(), guest.id)
				guest.send(map[string]any{"type": "ping"})
				deadline := time.Now().Add(2 * time.Second)
				for {
					g.mu.Lock()
					closed := g.closed[guest.id]
					g.mu.Unlock()
					if closed {
						break
					}
					if time.Now().After(deadline) {
						t.Fatal("not closed")
					}
					time.Sleep(10 * time.Millisecond)
				}
			})

			t.Run("cursors reach the others only", func(t *testing.T) {
				g := setup(t, b, Options{})
				roomID := uniq("room")
				h, _ := host(t, g, roomID)
				guest := join(t, g, roomID, "guest")
				h.send(map[string]any{"type": "cursor", "cursor": map[string]any{"x": 1, "y": 2}, "activeElementId": "c1"})
				m := g.wait(t, guest.id, "cursors", nil)
				entry := m["entries"].([]any)[0].(map[string]any)
				if entry["clientId"] != h.user.ID || entry["activeElementId"] != "c1" {
					t.Fatalf("cursors %v", m)
				}
				if len(g.all(h.id, "cursors")) != 0 {
					t.Fatal("own cursor echoed")
				}
			})

			t.Run("snapshot chunks fit API Gateway's message limit", func(t *testing.T) {
				g := setup(t, b, Options{})
				roomID := uniq("room")
				h, _ := host(t, g, roomID)
				big := strings.Repeat("é", 70_000)
				h.send(map[string]any{"type": "patch", "opId": "x:1", "baseVersion": 0, "patch": json.RawMessage(`{"doc":{"description":` + string(protocol.MustMarshal(big)) + `}}`)})
				g.wait(t, h.id, "ack", nil)
				g.maxPost = 128 * 1024
				guest := join(t, g, roomID, "guest")
				g.wait(t, guest.id, "snapshot:end", nil)
				var parts []map[string]any
				parts = g.all(guest.id, "snapshot:chunk")
				sort.Slice(parts, func(a, b int) bool { return parts[a]["index"].(float64) < parts[b]["index"].(float64) })
				var text strings.Builder
				for _, p := range parts {
					text.WriteString(p["data"].(string))
				}
				state, ok := protocol.ParseState([]byte(text.String()))
				if !ok || string(state.Doc["description"]) != string(protocol.MustMarshal(big)) {
					t.Fatal("snapshot did not round-trip")
				}
			})
		})
	}
}

func TestPackKeepsPostsUnderTheLimit(t *testing.T) {
	h := New(store.NewMemory(nil), newMemRegistry(), nil, Options{MaxPayload: 100, Batch: true, Log: func(string, ...any) {}})
	i := h.begin(context.Background())
	frames := [][]byte{[]byte(`{"a":"` + strings.Repeat("x", 40) + `"}`), []byte(`{"b":1}`), []byte(`{"c":"` + strings.Repeat("y", 60) + `"}`), []byte(`{"d":2}`)}
	posts := i.pack(frames)
	var all []any
	for _, p := range posts {
		if len(p) > 100 && strings.HasPrefix(string(p), "[") {
			t.Fatalf("post over the limit: %d", len(p))
		}
		var v any
		_ = json.Unmarshal(p, &v)
		if list, ok := v.([]any); ok {
			all = append(all, list...)
		} else {
			all = append(all, v)
		}
	}
	if len(all) != 4 {
		t.Fatalf("frames lost: %v", all)
	}
}
