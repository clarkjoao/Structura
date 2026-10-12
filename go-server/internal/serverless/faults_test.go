package serverless

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/clarkjoao/structura/go-server/internal/faults"
	"github.com/clarkjoao/structura/go-server/internal/protocol"
	"github.com/clarkjoao/structura/go-server/internal/store"
)

// ── Fault injection around the rooms, the registry and API Gateway ────────────────────────────

type faultyRooms struct {
	store.Rooms
	plan *faults.Plan
	// entries, when set, answers ReadEntries in place of the store when its last result is true.
	entries func(roomID string, from int64) ([]protocol.Entry, bool, bool)
}

func (f *faultyRooms) CreateRoom(ctx context.Context, in store.CreateInput) (bool, error) {
	if err := f.plan.Check("rooms.CreateRoom"); err != nil {
		return false, err
	}
	return f.Rooms.CreateRoom(ctx, in)
}
func (f *faultyRooms) AppendSeedChunk(ctx context.Context, roomID string, index int, literal string) error {
	if err := f.plan.Check("rooms.AppendSeedChunk"); err != nil {
		return err
	}
	return f.Rooms.AppendSeedChunk(ctx, roomID, index, literal)
}
func (f *faultyRooms) CommitSeed(ctx context.Context, roomID string) (store.CommitResult, error) {
	if err := f.plan.Check("rooms.CommitSeed"); err != nil {
		return store.CommitResult{}, err
	}
	return f.Rooms.CommitSeed(ctx, roomID)
}
func (f *faultyRooms) DiscardRoom(ctx context.Context, roomID string) error {
	if err := f.plan.Check("rooms.DiscardRoom"); err != nil {
		return err
	}
	return f.Rooms.DiscardRoom(ctx, roomID)
}
func (f *faultyRooms) GetMeta(ctx context.Context, roomID string) (*store.Meta, error) {
	if err := f.plan.Check("rooms.GetMeta"); err != nil {
		return nil, err
	}
	return f.Rooms.GetMeta(ctx, roomID)
}
func (f *faultyRooms) ApplyPatch(ctx context.Context, roomID string, in store.ApplyInput) (store.ApplyResult, error) {
	if err := f.plan.Check("rooms.ApplyPatch"); err != nil {
		return store.ApplyResult{}, err
	}
	return f.Rooms.ApplyPatch(ctx, roomID, in)
}
func (f *faultyRooms) ReadSnapshot(ctx context.Context, roomID string) (*store.Snapshot, error) {
	if err := f.plan.Check("rooms.ReadSnapshot"); err != nil {
		return nil, err
	}
	return f.Rooms.ReadSnapshot(ctx, roomID)
}
func (f *faultyRooms) ReadEntries(ctx context.Context, roomID string, from int64) ([]protocol.Entry, bool, error) {
	if err := f.plan.Check("rooms.ReadEntries"); err != nil {
		return nil, false, err
	}
	if f.entries != nil {
		if entries, ok, answered := f.entries(roomID, from); answered {
			return entries, ok, nil
		}
	}
	return f.Rooms.ReadEntries(ctx, roomID, from)
}
func (f *faultyRooms) AcquireLock(ctx context.Context, roomID, entityID, clientID string, ttl time.Duration) (bool, string, error) {
	if err := f.plan.Check("rooms.AcquireLock"); err != nil {
		return false, "", err
	}
	return f.Rooms.AcquireLock(ctx, roomID, entityID, clientID, ttl)
}
func (f *faultyRooms) ReleaseLock(ctx context.Context, roomID, entityID, clientID string) (bool, error) {
	if err := f.plan.Check("rooms.ReleaseLock"); err != nil {
		return false, err
	}
	return f.Rooms.ReleaseLock(ctx, roomID, entityID, clientID)
}
func (f *faultyRooms) MarkHostOffline(ctx context.Context, roomID string) (bool, error) {
	if err := f.plan.Check("rooms.MarkHostOffline"); err != nil {
		return false, err
	}
	return f.Rooms.MarkHostOffline(ctx, roomID)
}
func (f *faultyRooms) MarkHostOnline(ctx context.Context, roomID string) error {
	if err := f.plan.Check("rooms.MarkHostOnline"); err != nil {
		return err
	}
	return f.Rooms.MarkHostOnline(ctx, roomID)
}
func (f *faultyRooms) IsHostOnline(ctx context.Context, roomID string) (bool, error) {
	if err := f.plan.Check("rooms.IsHostOnline"); err != nil {
		return false, err
	}
	return f.Rooms.IsHostOnline(ctx, roomID)
}
func (f *faultyRooms) CloseRoom(ctx context.Context, roomID, reason string) (bool, error) {
	if err := f.plan.Check("rooms.CloseRoom"); err != nil {
		return false, err
	}
	return f.Rooms.CloseRoom(ctx, roomID, reason)
}

// queueRooms gives the memory store a patch queue, as DynamoDB has.
type queueRooms struct {
	*store.Memory
	mu     sync.Mutex
	queues map[string][]store.QueuedPatch
}

func (q *queueRooms) Enqueue(_ context.Context, roomID string, p store.QueuedPatch) error {
	q.mu.Lock()
	defer q.mu.Unlock()
	q.queues[roomID] = append(q.queues[roomID], p)
	return nil
}
func (q *queueRooms) QueuePending(_ context.Context, roomID string) (bool, error) {
	q.mu.Lock()
	defer q.mu.Unlock()
	return len(q.queues[roomID]) > 0, nil
}
func (q *queueRooms) ApplyQueued(ctx context.Context, roomID string) ([]store.QueuedResult, error) {
	q.mu.Lock()
	batch := q.queues[roomID]
	q.queues[roomID] = nil
	q.mu.Unlock()
	var out []store.QueuedResult
	for _, p := range batch {
		r, err := q.Memory.ApplyPatch(ctx, roomID, p.ApplyInput)
		if err != nil {
			return nil, err
		}
		out = append(out, store.QueuedResult{QueuedPatch: p, ApplyResult: r})
	}
	return out, nil
}

type faultySeqRooms struct {
	faultyRooms
	q *queueRooms
}

func (f *faultySeqRooms) Enqueue(ctx context.Context, roomID string, p store.QueuedPatch) error {
	if err := f.plan.Check("rooms.Enqueue"); err != nil {
		return err
	}
	return f.q.Enqueue(ctx, roomID, p)
}
func (f *faultySeqRooms) QueuePending(ctx context.Context, roomID string) (bool, error) {
	if err := f.plan.Check("rooms.QueuePending"); err != nil {
		return false, err
	}
	return f.q.QueuePending(ctx, roomID)
}
func (f *faultySeqRooms) ApplyQueued(ctx context.Context, roomID string) ([]store.QueuedResult, error) {
	if err := f.plan.Check("rooms.ApplyQueued"); err != nil {
		return nil, err
	}
	return f.q.ApplyQueued(ctx, roomID)
}

type faultyRegistry struct {
	Registry
	plan *faults.Plan
}

func (f *faultyRegistry) GetConn(ctx context.Context, connID string) (*ConnRecord, error) {
	if err := f.plan.Check("reg.GetConn"); err != nil {
		return nil, err
	}
	return f.Registry.GetConn(ctx, connID)
}
func (f *faultyRegistry) PutConn(ctx context.Context, rec ConnRecord) error {
	if err := f.plan.Check("reg.PutConn"); err != nil {
		return err
	}
	return f.Registry.PutConn(ctx, rec)
}
func (f *faultyRegistry) DeleteConn(ctx context.Context, connID string) error {
	if err := f.plan.Check("reg.DeleteConn"); err != nil {
		return err
	}
	return f.Registry.DeleteConn(ctx, connID)
}
func (f *faultyRegistry) AdvanceSeq(ctx context.Context, connID string, seq int64) error {
	if err := f.plan.Check("reg.AdvanceSeq"); err != nil {
		return err
	}
	return f.Registry.AdvanceSeq(ctx, connID, seq)
}
func (f *faultyRegistry) PutMember(ctx context.Context, roomID string, m Member) error {
	if err := f.plan.Check("reg.PutMember"); err != nil {
		return err
	}
	return f.Registry.PutMember(ctx, roomID, m)
}
func (f *faultyRegistry) SetDelivered(ctx context.Context, roomID string, delivered map[string]int64) error {
	if err := f.plan.Check("reg.SetDelivered"); err != nil {
		return err
	}
	return f.Registry.SetDelivered(ctx, roomID, delivered)
}
func (f *faultyRegistry) DeleteMember(ctx context.Context, roomID, connID string) error {
	if err := f.plan.Check("reg.DeleteMember"); err != nil {
		return err
	}
	return f.Registry.DeleteMember(ctx, roomID, connID)
}
func (f *faultyRegistry) ListMembers(ctx context.Context, roomID string) ([]Member, error) {
	if err := f.plan.Check("reg.ListMembers"); err != nil {
		return nil, err
	}
	return f.Registry.ListMembers(ctx, roomID)
}
func (f *faultyRegistry) AcquireLease(ctx context.Context, roomID, owner string, ttl time.Duration) (bool, error) {
	if err := f.plan.Check("reg.AcquireLease"); err != nil {
		return false, err
	}
	return f.Registry.AcquireLease(ctx, roomID, owner, ttl)
}
func (f *faultyRegistry) ReleaseLease(ctx context.Context, roomID, owner string) error {
	if err := f.plan.Check("reg.ReleaseLease"); err != nil {
		return err
	}
	return f.Registry.ReleaseLease(ctx, roomID, owner)
}
func (f *faultyRegistry) SetHostOffline(ctx context.Context, roomID string, since int64) error {
	if err := f.plan.Check("reg.SetHostOffline"); err != nil {
		return err
	}
	return f.Registry.SetHostOffline(ctx, roomID, since)
}
func (f *faultyRegistry) ClearHostOffline(ctx context.Context, roomID string) error {
	if err := f.plan.Check("reg.ClearHostOffline"); err != nil {
		return err
	}
	return f.Registry.ClearHostOffline(ctx, roomID)
}
func (f *faultyRegistry) HostOfflineSince(ctx context.Context, roomID string) (int64, error) {
	if err := f.plan.Check("reg.HostOfflineSince"); err != nil {
		return 0, err
	}
	return f.Registry.HostOfflineSince(ctx, roomID)
}
func (f *faultyRegistry) AddRoom(ctx context.Context, roomID string) error {
	if err := f.plan.Check("reg.AddRoom"); err != nil {
		return err
	}
	return f.Registry.AddRoom(ctx, roomID)
}
func (f *faultyRegistry) RemoveRoom(ctx context.Context, roomID string) error {
	if err := f.plan.Check("reg.RemoveRoom"); err != nil {
		return err
	}
	return f.Registry.RemoveRoom(ctx, roomID)
}
func (f *faultyRegistry) ListRooms(ctx context.Context) ([]string, error) {
	if err := f.plan.Check("reg.ListRooms"); err != nil {
		return nil, err
	}
	return f.Registry.ListRooms(ctx)
}

type faultyPoster struct {
	Poster
	plan *faults.Plan
}

func (f *faultyPoster) Post(ctx context.Context, connID string, payload []byte) error {
	if err := f.plan.Check("post.Post"); err != nil {
		return err
	}
	return f.Poster.Post(ctx, connID, payload)
}
func (f *faultyPoster) Disconnect(ctx context.Context, connID string) error {
	if err := f.plan.Check("post.Disconnect"); err != nil {
		return err
	}
	return f.Poster.Disconnect(ctx, connID)
}
func (f *faultyPoster) Alive(ctx context.Context, connID string) (bool, error) {
	if err := f.plan.Check("post.Alive"); err != nil {
		return false, err
	}
	return f.Poster.Alive(ctx, connID)
}

// ── The rig ────────────────────────────────────────────────────────────────

type logBook struct {
	mu    sync.Mutex
	lines []string
}

func (l *logBook) log(format string, args ...any) {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.lines = append(l.lines, fmt.Sprintf(format, args...))
}

func (l *logBook) all() string {
	l.mu.Lock()
	defer l.mu.Unlock()
	return strings.Join(l.lines, "\n")
}

func (l *logBook) reset() {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.lines = nil
}

// rig is a handler whose rooms, registry and API Gateway fail as the plan says, next to a plain
// handler on the same state for arranging it.
type rig struct {
	rooms *faultyRooms
	t     *testing.T
	g     *gateway
	h     *Handler
	plain *Handler
	mem   *store.Memory
	reg   *memRegistry
	plan  *faults.Plan
	logs  *logBook
}

func newRig(t *testing.T, queued bool, opt Options) *rig {
	mem := store.NewMemory(nil)
	reg := newMemRegistry()
	plan := &faults.Plan{}
	g := &gateway{t: t, received: map[string][]map[string]any{}, closed: map[string]bool{}, quiet: true}
	logs := &logBook{}
	r := &rig{t: t, g: g, mem: mem, reg: reg, plan: plan, logs: logs}
	r.rooms = &faultyRooms{Rooms: mem, plan: plan}
	var rooms store.Rooms = r.rooms
	var plainRooms store.Rooms = mem
	if queued {
		q := &queueRooms{Memory: mem, queues: map[string][]store.QueuedPatch{}}
		seq := &faultySeqRooms{faultyRooms: faultyRooms{Rooms: mem, plan: plan}, q: q}
		r.rooms, rooms, plainRooms = &seq.faultyRooms, seq, q
	}
	opt.Log = logs.log
	opt.Batch = true
	if opt.SeedWait == 0 {
		opt.SeedWait = time.Millisecond
	}
	if opt.SeqWait == 0 {
		opt.SeqWait = 50 * time.Millisecond
	}
	r.h = New(rooms, &faultyRegistry{Registry: reg, plan: plan}, &faultyPoster{Poster: g, plan: plan}, opt)
	plainOpt := opt
	plainOpt.Log = func(string, ...any) {}
	r.plain = New(plainRooms, reg, g, plainOpt)
	g.h = r.plain
	return r
}

// The calls whose failure the handlers tolerate by design: replies to a socket that may be gone,
// and clean-up that the next event or the reaper redoes.
var tolerated = map[string]bool{
	"post.Post": true, "post.Alive": true,
	"reg.ClearHostOffline": true, "reg.SetHostOffline": true, "reg.DeleteConn": true, "reg.DeleteMember": true,
	"reg.ListMembers": true, "reg.GetConn": true, "reg.RemoveRoom": true,
	"rooms.QueuePending": true, "rooms.GetMeta": true, "rooms.ReleaseLock": true, "rooms.MarkHostOffline": true,
}

// surfaced reports how the handlers made the last run's failure known, if they did: a log line,
// an `unavailable` error or a refused patch to a socket, or a socket sent back to reconnect.
func (r *rig) surfaced(conns ...string) error {
	if logs := r.logs.all(); strings.Contains(logs, "injected") || strings.Contains(logs, "failed") {
		return errors.New(logs)
	}
	for _, id := range conns {
		for _, m := range r.g.all(id, "error") {
			if m["code"] == protocol.ErrUnavailable {
				return errors.New("unavailable sent")
			}
		}
		for _, m := range r.g.all(id, "ack") {
			if m["applied"] == false {
				return errors.New("patch refused")
			}
		}
		r.g.mu.Lock()
		closed := r.g.closed[id]
		r.g.mu.Unlock()
		if closed {
			return errors.New("socket closed")
		}
	}
	return nil
}

func (r *rig) sweep(name string, setup func(), op func() error) {
	r.t.Helper()
	runs := faults.Sweep(r.plan, func() {
		r.logs.reset()
		setup()
	}, op, func(n int, err error) {
		failed := r.plan.LastFailed()
		if err == nil && !tolerated[failed] {
			r.t.Errorf("%s: %s (call %d) failed and nothing reported it", name, failed, n)
		}
	})
	if runs == 0 {
		r.t.Errorf("%s: made no call", name)
	}
}

// A client of the rig: it talks to either handler.
type rclient struct {
	r    *rig
	id   string
	user protocol.User
}

func (r *rig) connect(name string) *rclient {
	c := &rclient{r: r, id: uniq("conn"), user: protocol.User{ID: uniq(name), Name: name, Color: "#123"}}
	if err := r.plain.Connect(context.Background(), c.id); err != nil {
		r.t.Fatal(err)
	}
	return c
}

func (c *rclient) to(h *Handler, v any) {
	if err := h.Message(context.Background(), c.id, protocol.MustMarshal(v)); err != nil {
		c.r.t.Fatal(err)
	}
}

func (r *rig) hostRoom(h *Handler, roomID string) (*rclient, string) {
	c := r.connect("host")
	c.to(h, map[string]any{"type": "create", "protocol": 3, "roomId": roomID, "user": c.user, "seedChars": len(seed), "seedChunks": 1})
	created := r.g.wait(r.t, c.id, "created", nil)
	c.to(h, map[string]any{"type": "seed:chunk", "index": 0, "data": seed})
	c.to(h, map[string]any{"type": "seed:commit"})
	r.g.wait(r.t, c.id, "joined", nil)
	return c, created["hostToken"].(string)
}

func (r *rig) joinRoom(h *Handler, roomID, name string, extra map[string]any) *rclient {
	c := r.connect(name)
	msg := map[string]any{"type": "join", "protocol": 3, "roomId": roomID, "user": c.user}
	for k, v := range extra {
		msg[k] = v
	}
	c.to(h, msg)
	return c
}

// ── Sweeps ─────────────────────────────────────────────────────────────────

func TestHandlersReportEveryFailure(t *testing.T) {
	for _, queued := range []bool{false, true} {
		t.Run(fmt.Sprintf("queued=%v", queued), func(t *testing.T) {
			r := newRig(t, queued, Options{})
			ctx := context.Background()
			var roomID, token string
			var host, guest *rclient
			hosted := func() {
				roomID = uniq("room")
				host, token = r.hostRoom(r.plain, roomID)
			}
			withGuest := func() {
				hosted()
				guest = r.joinRoom(r.plain, roomID, "guest", nil)
				r.g.wait(t, guest.id, "joined", nil)
			}

			r.sweep("create and seed", func() { roomID = uniq("room") }, func() error {
				host = r.connect("host")
				host.to(r.h, map[string]any{"type": "create", "protocol": 3, "roomId": roomID, "user": host.user, "seedChars": len(seed), "seedChunks": 1, "hostToken": "t"})
				host.to(r.h, map[string]any{"type": "seed:chunk", "index": 0, "data": seed})
				host.to(r.h, map[string]any{"type": "seed:commit"})
				return r.surfaced(host.id)
			})
			r.sweep("an unreadable seed", func() { roomID = uniq("room") }, func() error {
				host = r.connect("host")
				host.to(r.h, map[string]any{"type": "create", "protocol": 3, "roomId": roomID, "user": host.user, "seedChars": 3, "seedChunks": 1})
				host.to(r.h, map[string]any{"type": "seed:chunk", "index": 0, "data": "{{{"})
				host.to(r.h, map[string]any{"type": "seed:commit"})
				return r.surfaced(host.id)
			})
			r.sweep("join", withGuest, func() error {
				c := r.joinRoom(r.h, roomID, "late", nil)
				return r.surfaced(c.id)
			})
			r.sweep("resume", func() {
				withGuest()
				guest.to(r.plain, map[string]any{"type": "patch", "opId": "g:1:1", "baseVersion": 0, "patch": map[string]any{"doc": map[string]any{"diagramName": "r"}}})
			}, func() error {
				meta, _ := r.mem.GetMeta(ctx, roomID)
				c := r.joinRoom(r.h, roomID, "back", map[string]any{"resumeFrom": 0, "resumeEpoch": meta.Epoch})
				return r.surfaced(c.id)
			})
			r.sweep("host returns", func() {
				withGuest()
				_ = r.plain.Disconnect(ctx, host.id)
			}, func() error {
				c := r.joinRoom(r.h, roomID, "host", map[string]any{"hostToken": token})
				return r.surfaced(c.id)
			})
			r.sweep("patch", withGuest, func() error {
				guest.to(r.h, map[string]any{"type": "patch", "opId": "g:1:1", "baseVersion": 0, "patch": map[string]any{"doc": map[string]any{"diagramName": "p"}}})
				return r.surfaced(guest.id)
			})
			r.sweep("lock and release", withGuest, func() error {
				guest.to(r.h, map[string]any{"type": "lock", "action": "acquire", "entityIds": []string{"c1", "c2"}})
				guest.to(r.h, map[string]any{"type": "lock", "action": "release", "entityIds": []string{"c1", "c2"}})
				return r.surfaced(guest.id)
			})
			r.sweep("cursor", withGuest, func() error {
				guest.to(r.h, map[string]any{"type": "cursor", "cursor": map[string]any{"x": 1, "y": 2}, "activeElementId": nil})
				return r.surfaced(guest.id)
			})
			r.sweep("close", withGuest, func() error {
				host.to(r.h, map[string]any{"type": "close"})
				return r.surfaced(host.id)
			})
			r.sweep("a guest holding locks leaves", func() {
				withGuest()
				guest.to(r.plain, map[string]any{"type": "lock", "action": "acquire", "entityIds": []string{"c1"}})
			}, func() error {
				err := r.h.Disconnect(ctx, guest.id)
				if s := r.surfaced(); s != nil {
					return s
				}
				return err
			})
			r.sweep("the host leaves", withGuest, func() error {
				err := r.h.Disconnect(ctx, host.id)
				if s := r.surfaced(); s != nil {
					return s
				}
				return err
			})
			r.sweep("a ping maintains the room", func() {
				withGuest()
				guest.to(r.plain, map[string]any{"type": "patch", "opId": "g:1:1", "baseVersion": 0, "patch": map[string]any{"doc": map[string]any{"diagramName": "m"}}})
				_ = r.reg.SetDelivered(ctx, roomID, map[string]int64{guest.id: 0})
			}, func() error {
				guest.to(r.h, map[string]any{"type": "ping"})
				return r.surfaced(guest.id)
			})
		})
	}
}

func TestReaperReportsEveryFailure(t *testing.T) {
	ctx := context.Background()
	// Each kind of room the reaper meets, swept on its own: the reaper visits rooms in parallel.
	kinds := map[string]func(r *rig, roomID string){
		"open, with a socket whose $disconnect was lost and entries not yet sent": func(r *rig, roomID string) {
			r.hostRoom(r.plain, roomID)
			guest := r.joinRoom(r.plain, roomID, "guest", nil)
			r.g.wait(t, guest.id, "joined", nil)
			gone := r.joinRoom(r.plain, roomID, "gone", nil)
			r.g.wait(t, gone.id, "joined", nil)
			guest.to(r.plain, map[string]any{"type": "patch", "opId": "g:1:1", "baseVersion": 0, "patch": map[string]any{"doc": map[string]any{"diagramName": "x"}}})
			_ = r.reg.SetDelivered(ctx, roomID, map[string]int64{guest.id: 0})
			r.g.mu.Lock()
			r.g.closed[gone.id] = true
			r.g.mu.Unlock()
		},
		"abandoned by its host": func(r *rig, roomID string) {
			host, _ := r.hostRoom(r.plain, roomID)
			guest := r.joinRoom(r.plain, roomID, "guest", nil)
			r.g.wait(t, guest.id, "joined", nil)
			_ = r.plain.Disconnect(ctx, host.id)
		},
		"closed": func(r *rig, roomID string) {
			r.hostRoom(r.plain, roomID)
			_, _ = r.mem.CloseRoom(ctx, roomID, protocol.ReasonHostClosed)
		},
		"lost from the store, with sockets": func(r *rig, roomID string) {
			r.hostRoom(r.plain, roomID)
			_ = r.mem.DiscardRoom(ctx, roomID)
		},
		"lost from the store, empty": func(r *rig, roomID string) {
			_ = r.reg.AddRoom(ctx, roomID)
		},
		"seeding for too long": func(r *rig, roomID string) {
			c := r.connect("seeding")
			c.to(r.plain, map[string]any{"type": "create", "protocol": 3, "roomId": roomID, "user": c.user, "seedChars": 10, "seedChunks": 1})
		},
		"seeding, its host gone": func(r *rig, roomID string) {
			c := r.connect("left")
			c.to(r.plain, map[string]any{"type": "create", "protocol": 3, "roomId": roomID, "user": c.user, "seedChars": 10, "seedChunks": 1})
			_ = r.plain.Disconnect(ctx, c.id)
		},
	}
	for _, queued := range []bool{false, true} {
		for kind, arrange := range kinds {
			t.Run(fmt.Sprintf("queued=%v/%s", queued, kind), func(t *testing.T) {
				var mu sync.Mutex
				clock := time.Now().UnixMilli()
				now := func() int64 { mu.Lock(); defer mu.Unlock(); return clock }
				r := newRig(t, queued, Options{Now: now, HostGrace: time.Second, StaleSeed: time.Minute})
				var roomID string
				setup := func() {
					if roomID != "" {
						_ = r.reg.RemoveRoom(ctx, roomID)
					}
					mu.Lock()
					clock = time.Now().UnixMilli()
					mu.Unlock()
					roomID = uniq("room")
					arrange(r, roomID)
					mu.Lock()
					clock += time.Hour.Milliseconds()
					mu.Unlock()
					r.logs.reset()
				}
				r.sweep("reap", setup, func() error {
					err := r.h.Reap(ctx)
					if s := r.surfaced(); s != nil {
						return s
					}
					return err
				})
				// And with nothing failing: only an open room stays indexed.
				setup()
				if err := r.h.Reap(ctx); err != nil {
					t.Fatal(err)
				}
				listed, _ := r.reg.ListRooms(ctx)
				stays := strings.HasPrefix(kind, "open")
				if (len(listed) == 1) != stays {
					t.Errorf("indexed after the reap: %v", listed)
				}
			})
		}
	}
}
