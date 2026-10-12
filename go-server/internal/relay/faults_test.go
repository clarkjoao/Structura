package relay

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"log"
	"os"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/clarkjoao/structura/go-server/internal/faults"
	"github.com/clarkjoao/structura/go-server/internal/protocol"
	"github.com/clarkjoao/structura/go-server/internal/store"
)

// faultyShared fails store calls as its plan says; calls are named by method.
type faultyShared struct {
	store.Shared
	plan        *faults.Plan
	nilSnapshot atomic.Bool
	panicOn     atomic.Value // method name
}

func (f *faultyShared) check(name string) error {
	if p, _ := f.panicOn.Load().(string); p == name {
		panic("injected panic in " + name)
	}
	return f.plan.Check(name)
}

func (f *faultyShared) CreateRoom(ctx context.Context, in store.CreateInput) (bool, error) {
	if err := f.check("CreateRoom"); err != nil {
		return false, err
	}
	return f.Shared.CreateRoom(ctx, in)
}
func (f *faultyShared) AppendSeedChunk(ctx context.Context, roomID string, index int, literal string) error {
	if err := f.check("AppendSeedChunk"); err != nil {
		return err
	}
	return f.Shared.AppendSeedChunk(ctx, roomID, index, literal)
}
func (f *faultyShared) CommitSeed(ctx context.Context, roomID string) (store.CommitResult, error) {
	if err := f.check("CommitSeed"); err != nil {
		return store.CommitResult{}, err
	}
	return f.Shared.CommitSeed(ctx, roomID)
}
func (f *faultyShared) DiscardRoom(ctx context.Context, roomID string) error {
	if err := f.check("DiscardRoom"); err != nil {
		return err
	}
	return f.Shared.DiscardRoom(ctx, roomID)
}
func (f *faultyShared) GetMeta(ctx context.Context, roomID string) (*store.Meta, error) {
	if err := f.check("GetMeta"); err != nil {
		return nil, err
	}
	return f.Shared.GetMeta(ctx, roomID)
}
func (f *faultyShared) ApplyPatch(ctx context.Context, roomID string, in store.ApplyInput) (store.ApplyResult, error) {
	if err := f.check("ApplyPatch"); err != nil {
		return store.ApplyResult{}, err
	}
	return f.Shared.ApplyPatch(ctx, roomID, in)
}
func (f *faultyShared) ReadSnapshot(ctx context.Context, roomID string) (*store.Snapshot, error) {
	if err := f.check("ReadSnapshot"); err != nil {
		return nil, err
	}
	if f.nilSnapshot.Load() {
		return nil, nil
	}
	return f.Shared.ReadSnapshot(ctx, roomID)
}
func (f *faultyShared) ReadEntries(ctx context.Context, roomID string, from int64) ([]protocol.Entry, bool, error) {
	if err := f.check("ReadEntries"); err != nil {
		return nil, false, err
	}
	return f.Shared.ReadEntries(ctx, roomID, from)
}
func (f *faultyShared) AcquireLock(ctx context.Context, roomID, entityID, clientID string, ttl time.Duration) (bool, string, error) {
	if err := f.check("AcquireLock"); err != nil {
		return false, "", err
	}
	return f.Shared.AcquireLock(ctx, roomID, entityID, clientID, ttl)
}
func (f *faultyShared) ReleaseLock(ctx context.Context, roomID, entityID, clientID string) (bool, error) {
	if err := f.check("ReleaseLock"); err != nil {
		return false, err
	}
	return f.Shared.ReleaseLock(ctx, roomID, entityID, clientID)
}
func (f *faultyShared) MarkHostOffline(ctx context.Context, roomID string) (bool, error) {
	if err := f.check("MarkHostOffline"); err != nil {
		return false, err
	}
	return f.Shared.MarkHostOffline(ctx, roomID)
}
func (f *faultyShared) MarkHostOnline(ctx context.Context, roomID string) error {
	if err := f.check("MarkHostOnline"); err != nil {
		return err
	}
	return f.Shared.MarkHostOnline(ctx, roomID)
}
func (f *faultyShared) IsHostOnline(ctx context.Context, roomID string) (bool, error) {
	if err := f.check("IsHostOnline"); err != nil {
		return false, err
	}
	return f.Shared.IsHostOnline(ctx, roomID)
}
func (f *faultyShared) CloseRoom(ctx context.Context, roomID, reason string) (bool, error) {
	if err := f.check("CloseRoom"); err != nil {
		return false, err
	}
	return f.Shared.CloseRoom(ctx, roomID, reason)
}
func (f *faultyShared) AddMember(ctx context.Context, roomID string, member protocol.Participant, connID string, expiresAt int64, max int, now int64) (store.AddMemberResult, error) {
	if err := f.check("AddMember"); err != nil {
		return store.AddMemberResult{}, err
	}
	return f.Shared.AddMember(ctx, roomID, member, connID, expiresAt, max, now)
}
func (f *faultyShared) TouchMembers(ctx context.Context, roomID string, clientIDs []string, expiresAt int64) error {
	if err := f.check("TouchMembers"); err != nil {
		return err
	}
	return f.Shared.TouchMembers(ctx, roomID, clientIDs, expiresAt)
}
func (f *faultyShared) RemoveMember(ctx context.Context, roomID, clientID, connID string, now int64) (int, error) {
	if err := f.check("RemoveMember"); err != nil {
		return 0, err
	}
	return f.Shared.RemoveMember(ctx, roomID, clientID, connID, now)
}
func (f *faultyShared) ListMembers(ctx context.Context, roomID string, now int64) ([]protocol.Participant, error) {
	if err := f.check("ListMembers"); err != nil {
		return nil, err
	}
	return f.Shared.ListMembers(ctx, roomID, now)
}
func (f *faultyShared) RenewHostLease(ctx context.Context, roomID string, expiresAt int64) error {
	if err := f.check("RenewHostLease"); err != nil {
		return err
	}
	return f.Shared.RenewHostLease(ctx, roomID, expiresAt)
}
func (f *faultyShared) ExpiredHostLeases(ctx context.Context, before int64) ([]string, error) {
	if err := f.check("ExpiredHostLeases"); err != nil {
		return nil, err
	}
	return f.Shared.ExpiredHostLeases(ctx, before)
}
func (f *faultyShared) Subscribe(ctx context.Context, roomID string, listener func(store.RoomEvent)) (store.Unsubscribe, error) {
	if err := f.check("Subscribe"); err != nil {
		return nil, err
	}
	return f.Shared.Subscribe(ctx, roomID, listener)
}
func (f *faultyShared) PublishPresence(ctx context.Context, roomID string, event store.PresenceEvent) error {
	if err := f.check("PublishPresence"); err != nil {
		return err
	}
	return f.Shared.PublishPresence(ctx, roomID, event)
}
func (f *faultyShared) SubscribePresence(ctx context.Context, roomID string, listener func(store.PresenceEvent)) (store.Unsubscribe, error) {
	if err := f.check("SubscribePresence"); err != nil {
		return nil, err
	}
	return f.Shared.SubscribePresence(ctx, roomID, listener)
}

// logBook collects what a relay logs.
type logBook struct {
	mu    sync.Mutex
	lines []string
}

func (l *logBook) log(format string, args ...any) {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.lines = append(l.lines, fmt.Sprintf(format, args...))
}

func (l *logBook) failures() string {
	l.mu.Lock()
	defer l.mu.Unlock()
	var out []string
	for _, line := range l.lines {
		if strings.Contains(line, "failed") || strings.Contains(line, "injected") {
			out = append(out, line)
		}
	}
	return strings.Join(out, "\n")
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

// rig is a relay on a faulty store, a plain relay on the same rooms for arranging state, and
// what the faulty one logs.
type rig struct {
	t      *testing.T
	mem    *store.Memory
	faulty *faultyShared
	r      *Relay
	plain  *Relay
	logs   *logBook
}

func newRig(t *testing.T, opt Options) *rig {
	t.Helper()
	mem := store.NewMemory(nil)
	faulty := &faultyShared{Shared: mem, plan: &faults.Plan{}}
	logs := &logBook{}
	if opt.HostGrace == 0 {
		opt = fast
	}
	opt.DisableTimers = true
	opt.Log = logs.log
	plainOpt := fast
	plainOpt.DisableTimers = true
	return &rig{t: t, mem: mem, faulty: faulty, r: newRelay(t, faulty, opt), plain: newRelay(t, mem, plainOpt), logs: logs}
}

// surfaced is the failure the relay reported for the last run, if any: a log line, or an
// `unavailable` error frame to one of the clients.
func (g *rig) surfaced(clients ...*fakeClient) error {
	if f := g.logs.failures(); f != "" {
		return errors.New(f)
	}
	for _, c := range clients {
		for _, m := range c.all("error") {
			if m.str("code") == protocol.ErrUnavailable {
				return errors.New("unavailable sent")
			}
		}
	}
	return nil
}

func (g *rig) sweep(name string, setup func(), op func() error) {
	g.t.Helper()
	runs := faults.Sweep(g.faulty.plan, func() { g.logs.reset(); setup() }, op, func(n int, err error) {
		if err == nil {
			g.t.Errorf("%s: store call %d failed and nothing reported it", name, n)
		}
	})
	if runs == 0 {
		g.t.Errorf("%s: made no store call", name)
	}
}

func createMessage(c *fakeClient, roomID string, token *string) map[string]any {
	text := string(seedState)
	msg := map[string]any{"type": "create", "protocol": 3, "roomId": roomID, "user": c.user,
		"seedChars": protocol.UTF16Len(text), "seedChunks": len(protocol.ChunkString(text, protocol.ChunkChars))}
	if token != nil {
		msg["hostToken"] = *token
	}
	return msg
}

func seed(c *fakeClient, data string) {
	for i, chunk := range protocol.ChunkString(data, protocol.ChunkChars) {
		c.write(map[string]any{"type": "seed:chunk", "index": i, "data": chunk})
	}
	c.write(map[string]any{"type": "seed:commit"})
}

func TestRelayReportsEveryStoreFailure(t *testing.T) {
	g := newRig(t, Options{})
	var roomID, token string
	var host, guest *fakeClient
	hosted := func() {
		roomID = nextRoomID()
		host, token = hostRoom(t, g.plain, roomID)
	}
	withGuest := func() {
		hosted()
		guest = joinRoom(t, g.r, roomID, "guest", nil)
		ready(t, guest)
		g.logs.reset()
	}

	g.sweep("create and seed", func() { roomID = nextRoomID() }, func() error {
		host = newClient(t, "host").attach(g.r)
		tok := "fixed-token"
		host.write(createMessage(host, roomID, &tok))
		seed(host, string(seedState))
		return g.surfaced(host)
	})
	g.sweep("discard an unreadable seed", func() { roomID = nextRoomID() }, func() error {
		host = newClient(t, "host").attach(g.r)
		host.write(createMessage(host, roomID, nil))
		seed(host, strings.Repeat(" ", len(seedState)))
		return g.surfaced(host)
	})
	g.sweep("join", hosted, func() error {
		guest = joinRoom(t, g.r, roomID, "guest", nil)
		return g.surfaced(guest)
	})
	g.sweep("resume", func() {
		hosted()
		host.write(patchMsg("p1", 0, `{"doc":{"diagramName":"x"}}`))
	}, func() error {
		meta, _ := g.mem.GetMeta(context.Background(), roomID)
		guest = joinRoom(t, g.r, roomID, "guest", map[string]any{"resumeFrom": 0, "resumeEpoch": meta.Epoch})
		return g.surfaced(guest)
	})
	g.sweep("host returns", func() {
		hosted()
		host.drop()
		waitFor(t, func() bool { _, _, closed := host.closedWith(); return closed })
		_, _ = g.mem.MarkHostOffline(context.Background(), roomID)
	}, func() error {
		back := joinRoom(t, g.r, roomID, "host", map[string]any{"hostToken": token})
		return g.surfaced(back)
	})
	g.sweep("patch", withGuest, func() error {
		guest.write(patchMsg("p1", 0, `{"doc":{"diagramName":"y"}}`))
		return g.surfaced(guest)
	})
	g.sweep("lock and release", withGuest, func() error {
		guest.write(map[string]any{"type": "lock", "action": "acquire", "entityIds": []string{"c1", "c2"}})
		guest.write(map[string]any{"type": "lock", "action": "release", "entityIds": []string{"c1", "c2"}})
		return g.surfaced(guest)
	})
	g.sweep("close", func() {
		roomID = nextRoomID()
		host, _ = hostRoom(t, g.r, roomID)
		g.logs.reset()
	}, func() error {
		host.write(map[string]any{"type": "close"})
		return g.surfaced(host)
	})
	g.sweep("leave holding locks", func() {
		withGuest()
		guest.write(map[string]any{"type": "lock", "action": "acquire", "entityIds": []string{"c1", "c2"}})
		g.logs.reset()
	}, func() error {
		guest.handlers.OnClose()
		return g.surfaced()
	})
}

func TestRelayRenewalsReportEveryStoreFailure(t *testing.T) {
	g := newRig(t, Options{})
	var host, guest *fakeClient
	g.sweep("renew leases and members", func() {
		// One room at a time: the renewals touch every room of the relay.
		if host != nil {
			guest.handlers.OnClose()
			host.handlers.OnClose()
		}
		roomID := nextRoomID()
		host, _ = hostRoom(t, g.r, roomID)
		guest = joinRoom(t, g.r, roomID, "guest", nil)
		ready(t, guest)
		g.logs.reset()
	}, func() error {
		g.r.renewHostLeases(context.Background())
		g.r.renewMembers(context.Background())
		return g.surfaced()
	})
}

func TestRelayReaperReportsEveryStoreFailure(t *testing.T) {
	clock := atomic.Int64{}
	clock.Store(time.Now().UnixMilli())
	opt := fast
	opt.Now = clock.Load
	g := newRig(t, opt)
	var roomIDs []string
	setup := func() {
		// One room past the grace period, one still seeding past it.
		clock.Store(time.Now().UnixMilli())
		for _, id := range roomIDs {
			_, _ = g.mem.CloseRoom(context.Background(), id, protocol.ReasonHostClosed)
			_ = g.mem.DiscardRoom(context.Background(), id)
		}
		roomIDs = []string{nextRoomID(), nextRoomID()}
		hostRoom(t, g.plain, roomIDs[0])
		seeding := newClient(t, "seeding").attach(g.plain)
		seeding.write(createMessage(seeding, roomIDs[1], nil))
		clock.Add(time.Hour.Milliseconds())
	}
	g.sweep("reap", setup, func() error {
		g.r.reap(context.Background())
		return g.surfaced()
	})
	setup()
	g.r.reap(context.Background())
	if meta, _ := g.mem.GetMeta(context.Background(), roomIDs[1]); meta != nil {
		t.Error("a seeding room past its lease was kept")
	}
	if meta, _ := g.mem.GetMeta(context.Background(), roomIDs[0]); meta == nil || meta.Status != store.StatusClosed {
		t.Errorf("an abandoned room was not closed: %+v", meta)
	}
}

func TestRelayEdgeCases(t *testing.T) {
	ctx := context.Background()

	t.Run("refuses messages out of turn", func(t *testing.T) {
		g := newRig(t, Options{})
		c := newClient(t, "c").attach(g.r)
		c.writeRaw(`{"type":"nope"}`)
		c.write(map[string]any{"type": "seed:chunk", "index": 0, "data": "x"})
		c.write(map[string]any{"type": "seed:commit"})
		c.write(patchMsg("p", 0, `{}`))
		c.write(map[string]any{"type": "lock", "action": "acquire", "entityId": "c1"})
		c.write(map[string]any{"type": "cursor", "cursor": nil, "activeElementId": nil})
		c.write(map[string]any{"type": "pong"})
		codes := map[string]int{}
		for _, m := range c.all("error") {
			codes[m.str("code")]++
		}
		if codes[protocol.ErrInvalidMessage] != 1 || codes[protocol.ErrNotJoined] != 4 {
			t.Errorf("codes %v", codes)
		}

		roomID := nextRoomID()
		c.write(createMessage(c, roomID, nil))
		c.write(createMessage(c, roomID, nil))
		c.write(map[string]any{"type": "seed:chunk", "index": 99, "data": "x"})
		c.write(map[string]any{"type": "join", "protocol": 3, "roomId": roomID, "user": c.user})
		if n := len(c.all("error")); n != 8 {
			t.Errorf("%d errors: %v", n, c.all("error"))
		}

		v2 := newClient(t, "old").attach(g.r)
		msg := createMessage(v2, nextRoomID(), nil)
		msg["protocol"] = 2
		v2.write(msg)
		if _, reason, closed := v2.closedWith(); !closed || reason != "protocol_mismatch" {
			t.Errorf("old protocol: %v %q", closed, reason)
		}
		v2.write(map[string]any{"type": "ping"})
		if len(v2.all("pong")) != 0 {
			t.Error("a closed socket was answered")
		}

		seeding := joinRoom(t, g.r, roomID, "early", nil)
		if m := seeding.next("error", nil); m.str("code") != protocol.ErrNotReady {
			t.Errorf("join while seeding: %v", m)
		}
	})

	t.Run("a room that closes while a guest joins", func(t *testing.T) {
		g := newRig(t, Options{})
		roomID := nextRoomID()
		hostRoom(t, g.plain, roomID)
		g.faulty.nilSnapshot.Store(true)
		guest := joinRoom(t, g.r, roomID, "guest", nil)
		if m := guest.next("error", nil); m.str("code") != protocol.ErrSessionClosed {
			t.Errorf("error %v", m)
		}
		g.faulty.nilSnapshot.Store(false)

		// The socket closes while its snapshot is read: it never goes live.
		var late *fakeClient
		g.faulty.plan.Only(func(name string) bool { return name == "ReadSnapshot" })
		g.faulty.plan.Before(func(string) { late.handlers.OnClose() })
		late = newClient(t, "late").attach(g.r)
		late.write(map[string]any{"type": "join", "protocol": 3, "roomId": roomID, "user": late.user})
		g.faulty.plan.Before(nil)
		g.faulty.plan.Only(nil)
		late.write(map[string]any{"type": "ping"})
		if len(late.all("pong")) != 0 {
			t.Error("a socket closed during its join went live")
		}
	})

	t.Run("a patch to a room that closed meanwhile", func(t *testing.T) {
		g := newRig(t, Options{})
		roomID := nextRoomID()
		hostRoom(t, g.plain, roomID)
		guest := joinRoom(t, g.r, roomID, "guest", nil)
		ready(t, guest)
		g.faulty.plan.Only(func(name string) bool { return name == "ApplyPatch" })
		g.faulty.plan.Before(func(string) { _, _ = g.mem.CloseRoom(ctx, roomID, protocol.ReasonHostClosed) })
		guest.handlers.OnMessage(protocol.MustMarshal(patchMsg("p1", 0, `{"doc":{"diagramName":"z"}}`)))
		g.faulty.plan.Before(nil)
		g.faulty.plan.Only(nil)
		ack := guest.next("ack", nil)
		if applied, _ := ack["applied"].(bool); applied {
			t.Errorf("ack %v", ack)
		}
	})

	t.Run("rate limits locks and cursors", func(t *testing.T) {
		opt := fast
		opt.LockRate = Rate{Rate: 0.001, Burst: 1}
		opt.CursorRate = Rate{Rate: 0.001, Burst: 1}
		g := newRig(t, opt)
		roomID := nextRoomID()
		hostRoom(t, g.plain, roomID)
		guest := joinRoom(t, g.r, roomID, "guest", nil)
		ready(t, guest)
		for i := 0; i < 2; i++ {
			guest.write(map[string]any{"type": "lock", "action": "renew", "entityId": "c1"})
			guest.write(map[string]any{"type": "cursor", "cursor": map[string]any{"x": i, "y": 0}, "activeElementId": nil})
		}
		if m := guest.next("error", nil); m.str("code") != protocol.ErrRateLimited {
			t.Errorf("error %v", m)
		}
		g.r.mu.Lock()
		cursor := g.r.rooms[roomID].cursors[guest.user.ID]
		g.r.mu.Unlock()
		if cursor.Cursor == nil || cursor.Cursor.X != 0 {
			t.Errorf("cursor %+v", cursor)
		}
	})

	t.Run("a stale subscription is dropped for a recreated room", func(t *testing.T) {
		g := newRig(t, Options{})
		roomID := nextRoomID()
		hostRoom(t, g.plain, roomID)
		first := joinRoom(t, g.r, roomID, "first", nil)
		ready(t, first)
		// The room is recreated under the same id behind this relay's back.
		_ = g.mem.DiscardRoom(ctx, roomID)
		hostRoom(t, g.plain, roomID)
		second := joinRoom(t, g.r, roomID, "second", nil)
		ready(t, second)
		if _, reason, closed := first.closedWith(); !closed || reason != "room_lost" {
			t.Errorf("stale socket: %v %q", closed, reason)
		}
	})

	t.Run("a join gives up waiting for a slow subscription", func(t *testing.T) {
		opt := fast
		opt.OperationTimeout = 50 * time.Millisecond
		g := newRig(t, opt)
		roomID := nextRoomID()
		hostRoom(t, g.plain, roomID)
		release := make(chan struct{})
		g.faulty.plan.Only(func(name string) bool { return name == "Subscribe" })
		g.faulty.plan.Before(func(string) { <-release })
		slow := newClient(t, "slow").attach(g.r)
		go slow.write(map[string]any{"type": "join", "protocol": 3, "roomId": roomID, "user": slow.user})
		waitFor(t, func() bool { return g.faulty.plan.Calls() == 1 })
		waiter := joinRoom(t, g.r, roomID, "waiter", nil)
		close(release)
		g.faulty.plan.Before(nil)
		g.faulty.plan.Only(nil)
		if err := g.surfaced(waiter); err == nil || !strings.Contains(err.Error(), "deadline") {
			t.Errorf("waiter: %v", err)
		}
	})

	t.Run("presence events it cannot read are ignored", func(t *testing.T) {
		g := newRig(t, Options{})
		roomID := nextRoomID()
		hostRoom(t, g.plain, roomID)
		guest := joinRoom(t, g.r, roomID, "guest", nil)
		ready(t, guest)
		before := len(guest.received)
		for _, e := range []store.PresenceEvent{{Kind: "peer:joined"}, {Kind: "host:status"}, {Kind: "other"}} {
			g.r.onPresence(roomID, e)
		}
		// An event for a room this relay no longer serves (it arrived after the last socket left).
		g.r.onRoomEvent(nextRoomID(), store.RoomEvent{CloseReason: protocol.ReasonHostClosed})
		// An entry the socket was already sent (a resume overlapping the live stream) is not resent.
		g.r.onRoomEvent(roomID, store.RoomEvent{Entry: &protocol.Entry{Version: 0}})
		if len(guest.received) != before {
			t.Errorf("sent %v", guest.received[before:])
		}
	})

	t.Run("only a client's last socket leaves the room", func(t *testing.T) {
		g := newRig(t, Options{})
		roomID := nextRoomID()
		hostRoom(t, g.plain, roomID)
		first := newClient(t, "twice").attach(g.r)
		first.write(map[string]any{"type": "join", "protocol": 3, "roomId": roomID, "user": first.user})
		ready(t, first)
		second := &fakeClient{t: t, user: first.user, changed: make(chan struct{}, 1)}
		second.attach(g.r)
		second.write(map[string]any{"type": "join", "protocol": 3, "roomId": roomID, "user": second.user})
		ready(t, second)
		first.handlers.OnClose()
		members, _ := g.mem.ListMembers(ctx, roomID, time.Now().UnixMilli())
		found := false
		for _, m := range members {
			found = found || m.ClientID == first.user.ID
		}
		if !found {
			t.Error("the old socket removed the client its new socket still serves")
		}
	})

	t.Run("checkRooms skips rooms it cannot read or that changed meanwhile", func(t *testing.T) {
		g := newRig(t, Options{})
		roomID := nextRoomID()
		hostRoom(t, g.plain, roomID)
		guest := joinRoom(t, g.r, roomID, "guest", nil)
		ready(t, guest)
		g.faulty.plan.FailAt(1)
		g.r.checkRooms(ctx)
		g.faulty.plan.Off()
		if _, _, closed := guest.closedWith(); closed {
			t.Error("dropped on a failed read")
		}
		// The room goes and its local subscription is replaced while it is checked.
		_ = g.mem.DiscardRoom(ctx, roomID)
		g.faulty.plan.Only(func(name string) bool { return name == "GetMeta" })
		g.faulty.plan.Before(func(string) {
			g.r.mu.Lock()
			room := g.r.rooms[roomID]
			g.r.mu.Unlock()
			if room != nil {
				g.r.dropLocalRoom(roomID, room)
			}
		})
		g.r.checkRooms(ctx)
		g.faulty.plan.Before(nil)
		g.faulty.plan.Only(nil)
		if strings.Contains(g.logs.all(), "room lost from storage") {
			t.Error("a replaced subscription was dropped twice")
		}
	})

	t.Run("a socket that never joined leaves nothing to clean up", func(t *testing.T) {
		g := newRig(t, Options{})
		c := newClient(t, "idle").attach(g.r)
		g.faulty.plan.FailFrom(1)
		c.handlers.OnClose()
		calls := g.faulty.plan.Calls()
		g.faulty.plan.Off()
		if calls != 0 || g.logs.failures() != "" {
			t.Errorf("store calls %d, logs %q", calls, g.logs.failures())
		}
	})

	t.Run("a socket too far behind is closed", func(t *testing.T) {
		g := newRig(t, Options{})
		c := newClient(t, "slow").attach(g.r)
		c.queued.Store(1 << 30)
		c.write(map[string]any{"type": "ping"})
		if _, reason, closed := c.closedWith(); !closed || reason != "backpressure" {
			t.Errorf("closed %v %q", closed, reason)
		}
	})

	t.Run("a panicking timer task is logged", func(t *testing.T) {
		g := newRig(t, Options{})
		g.faulty.panicOn.Store("ExpiredHostLeases")
		g.r.every(5*time.Millisecond, g.r.reap)
		waitFor(t, func() bool { return strings.Contains(g.logs.failures(), "timer failed") })
		g.faulty.panicOn.Store("")
	})
}

func TestRelayDefaultsAndStop(t *testing.T) {
	var logged bytes.Buffer
	log.SetOutput(&logged)
	defer log.SetOutput(os.Stderr)
	r := New(store.NewMemory(nil), Options{DisableTimers: true})
	if r.opt.HostGrace != protocol.HostGraceMs*time.Millisecond || r.opt.HostLease != 5*time.Second ||
		r.opt.HostLeaseRenew != 2*time.Second || r.opt.ReaperInterval != time.Second || r.opt.RoomCheck != 2*time.Second ||
		r.opt.CursorFlush != 50*time.Millisecond || r.opt.MemberRenew != 10*time.Second {
		t.Errorf("defaults %+v", r.opt)
	}
	r.opt.Log("hello %s", "log")
	if !strings.Contains(logged.String(), "hello log") {
		t.Error("the default log is not the standard logger")
	}
	r.Stop()
	r.Stop()
}

func waitFor(t *testing.T, cond func() bool) {
	t.Helper()
	deadline := time.Now().Add(5 * time.Second)
	for !cond() {
		if time.Now().After(deadline) {
			t.Fatal("timed out")
		}
		time.Sleep(2 * time.Millisecond)
	}
}
