package store

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/redis/go-redis/v9"

	"github.com/clarkjoao/structura/go-server/internal/faults"
	"github.com/clarkjoao/structura/go-server/internal/protocol"
)

// faultyRedis is a Redis store whose command connection fails as the plan says.
func faultyRedis(t *testing.T, opts RedisOptions) (*Redis, *faults.Plan) {
	t.Helper()
	url := os.Getenv("REDIS_URL")
	if url == "" {
		t.Skip("REDIS_URL not set")
	}
	if opts.Namespace == "" {
		opts.Namespace = fmt.Sprintf("gotest-%d-%d:", os.Getpid(), time.Now().UnixNano())
	}
	s, err := NewRedis(url, opts)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = s.Close() })
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := s.Ready(ctx); err != nil {
		t.Fatal(err)
	}
	plan := &faults.Plan{}
	s.cmd.AddHook(faults.RedisHook{Plan: plan})
	return s, plan
}

// replyHook replaces the reply of the commands it matches.
type replyHook struct {
	mu    sync.Mutex
	match string
	value any
}

func (h *replyHook) set(match string, value any) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.match, h.value = match, value
}

func (h *replyHook) DialHook(next redis.DialHook) redis.DialHook { return next }
func (h *replyHook) ProcessPipelineHook(next redis.ProcessPipelineHook) redis.ProcessPipelineHook {
	return next
}
func (h *replyHook) ProcessHook(next redis.ProcessHook) redis.ProcessHook {
	return func(ctx context.Context, cmd redis.Cmder) error {
		err := next(ctx, cmd)
		h.mu.Lock()
		match, value := h.match, h.value
		h.mu.Unlock()
		if c, ok := cmd.(*redis.Cmd); ok && match != "" && cmd.Name() == match {
			c.SetErr(nil)
			c.SetVal(value)
			return nil
		}
		return err
	}
}

func mustFail(t *testing.T, what string) func(int, error) {
	return func(n int, err error) {
		t.Helper()
		if err == nil {
			t.Errorf("%s: call %d failed but the operation reported no error", what, n)
		}
	}
}

func applyName(t *testing.T, s Rooms, roomID, name string) {
	t.Helper()
	patch := protocol.Patch{Doc: map[string]json.RawMessage{"diagramName": json.RawMessage(`"` + name + `"`)}}
	if r, err := s.ApplyPatch(context.Background(), roomID, ApplyInput{Patch: patch, SenderID: "a", SenderVersion: 1 << 40, OpID: name}); err != nil || r.Status != Applied {
		t.Fatalf("apply %s: %+v %v", name, r, err)
	}
}

func TestRedisReportsEveryFailedCommand(t *testing.T) {
	ctx := context.Background()
	s, plan := faultyRedis(t, RedisOptions{})
	var roomID string
	fresh := func() { roomID = nextRoomID() }
	open := func() { roomID = nextRoomID(); openRoom(t, s, roomID, emptySeed()) }
	seeding := func() {
		roomID = nextRoomID()
		_, _ = s.CreateRoom(ctx, CreateInput{RoomID: roomID, HostTokenHash: "h", HostUser: host, SeedChunks: 1, Now: NowMs()})
		_ = s.AppendSeedChunk(ctx, roomID, 0, literal(t, string(emptySeed())))
	}
	withEntry := func() { open(); applyName(t, s, roomID, "one") }

	sweeps := []struct {
		name  string
		setup func()
		op    func() error
	}{
		{"create", fresh, func() error { _, err := s.CreateRoom(ctx, CreateInput{RoomID: roomID, SeedChunks: 1}); return err }},
		{"commit", seeding, func() error { _, err := s.CommitSeed(ctx, roomID); return err }},
		{"discard", open, func() error { return s.DiscardRoom(ctx, roomID) }},
		{"apply", open, func() error {
			_, err := s.ApplyPatch(ctx, roomID, ApplyInput{Patch: protocol.Patch{Doc: map[string]json.RawMessage{"level": json.RawMessage(`"x"`)}}})
			return err
		}},
		{"snapshot", open, func() error { _, err := s.ReadSnapshot(ctx, roomID); return err }},
		{"entries", withEntry, func() error { _, _, err := s.ReadEntries(ctx, roomID, 0); return err }},
		{"acquire", open, func() error { _, _, err := s.AcquireLock(ctx, roomID, "e", "c", time.Second); return err }},
		{"release", open, func() error { _, err := s.ReleaseLock(ctx, roomID, "e", "c"); return err }},
		{"offline", open, func() error { _, err := s.MarkHostOffline(ctx, roomID); return err }},
		{"online", open, func() error { return s.MarkHostOnline(ctx, roomID) }},
		{"is online", open, func() error { _, err := s.IsHostOnline(ctx, roomID); return err }},
		{"close", open, func() error { _, err := s.CloseRoom(ctx, roomID, protocol.ReasonHostClosed); return err }},
		{"add member", open, func() error {
			_, err := s.AddMember(ctx, roomID, protocol.Participant{ClientID: "c"}, "conn", NowMs()+1000, 10, NowMs())
			return err
		}},
		{"touch members", open, func() error { return s.TouchMembers(ctx, roomID, []string{"c"}, NowMs()+1000) }},
		{"remove member", open, func() error { _, err := s.RemoveMember(ctx, roomID, "c", "conn", NowMs()); return err }},
		{"list members", open, func() error { _, err := s.ListMembers(ctx, roomID, NowMs()); return err }},
		{"renew lease", open, func() error { return s.RenewHostLease(ctx, roomID, NowMs()) }},
		{"expired leases", func() {
			// One live room at a time: the listing reads each live room's status.
			if roomID != "" {
				_, _ = s.CloseRoom(ctx, roomID, protocol.ReasonHostClosed)
			}
			open()
		}, func() error { _, err := s.ExpiredHostLeases(ctx, NowMs()+1); return err }},
		{"subscribe", open, func() error {
			unsubscribe, err := s.Subscribe(ctx, roomID, func(RoomEvent) {})
			if err == nil {
				unsubscribe()
			}
			return err
		}},
	}
	for _, sw := range sweeps {
		if runs := faults.Sweep(plan, sw.setup, sw.op, mustFail(t, sw.name)); runs == 0 {
			t.Errorf("%s: made no call", sw.name)
		}
	}
}

func TestRedisCommitStopsWhenTheRoomLeftSeeding(t *testing.T) {
	ctx := context.Background()
	s, plan := faultyRedis(t, RedisOptions{})
	roomID := nextRoomID()
	_, _ = s.CreateRoom(ctx, CreateInput{RoomID: roomID, HostTokenHash: "h", HostUser: host, SeedChunks: 1, Now: NowMs()})
	_ = s.AppendSeedChunk(ctx, roomID, 0, literal(t, string(emptySeed())))
	// The room goes (a discard, a close) between reading its meta and committing.
	plan.Only(func(name string) bool { return name == "evalsha" })
	plan.Before(func(string) { s.cmd.Del(ctx, s.Prefix(roomID)+":meta") })
	defer plan.Only(nil)
	defer plan.Before(nil)
	if r, err := s.CommitSeed(ctx, roomID); err != nil || r.Code != "not_seeding" {
		t.Errorf("commit: %+v %v", r, err)
	}
}

func TestRedisReadsUnexpectedScriptRepliesAsNothing(t *testing.T) {
	ctx := context.Background()
	s, _ := faultyRedis(t, RedisOptions{})
	roomID := nextRoomID()
	openRoom(t, s, roomID, emptySeed())
	hook := &replyHook{}
	s.cmd.AddHook(hook)
	defer hook.set("", nil)

	hook.set("evalsha", []any{})
	if r, err := s.ApplyPatch(ctx, roomID, ApplyInput{}); err != nil || r.Status != NotOpen {
		t.Errorf("apply: %+v %v", r, err)
	}
	if ok, holder, err := s.AcquireLock(ctx, roomID, "e", "c", time.Second); ok || holder != "" || err != nil {
		t.Errorf("acquire: %v %q %v", ok, holder, err)
	}
	if r, err := s.AddMember(ctx, roomID, protocol.Participant{ClientID: "c"}, "conn", 1, 1, 0); r.OK || err != nil {
		t.Errorf("add member: %+v %v", r, err)
	}
	if snap, err := s.ReadSnapshot(ctx, roomID); snap != nil || err != nil {
		t.Errorf("short snapshot: %+v %v", snap, err)
	}
	// A snapshot reply with malformed collections keeps what it can read.
	hook.set("evalsha", []any{"3", []any{"diagramName", `"D"`, "nope", "1", "", "x"}, []any{
		[]any{"components"},
		[]any{"unknown", []any{}},
		[]any{"components", []any{[]any{"c1"}, []any{"c2", []any{"name", `"B"`}}}},
	}})
	snap, err := s.ReadSnapshot(ctx, roomID)
	if err != nil || snap == nil || snap.Version != 3 {
		t.Fatalf("snapshot: %+v %v", snap, err)
	}
	if string(snap.State.Doc["diagramName"]) != `"D"` || len(snap.State.Doc) != 1 {
		t.Errorf("doc %v", snap.State.Doc)
	}
	if ids := snap.State.IDs("components"); len(ids) != 1 || ids[0] != "c2" {
		t.Errorf("components %v", ids)
	}
}

func TestRedisWireAndEventDecodingSkipMalformedParts(t *testing.T) {
	if p := fromWire("not json"); !p.IsEmpty() {
		t.Errorf("garbage decoded to %+v", p)
	}
	p := fromWire(`{"doc":[["diagramName"],["nope","1"],["level","\"L\""]],"ent":[` +
		`["components"],["unknown","x",0,[],[]],` +
		`["components","c1",0,[["name"],["name","\"A\""]],["old"]],` +
		`["components","c2",1,[],[]]]}`)
	if len(p.Doc) != 1 || string(p.Doc["level"]) != `"L"` {
		t.Errorf("doc %v", p.Doc)
	}
	c1 := p.Entities["components"]["c1"]
	if c1 == nil || string(c1.Set["name"]) != `"A"` || len(c1.Unset) != 1 || !p.Entities["components"]["c2"].Delete {
		t.Errorf("entities %+v", p.Entities)
	}
	if asList([]byte(`{}`)) != nil {
		t.Error("asList of an object")
	}

	if toInt("42") != 42 || toInt(int64(7)) != 7 || toInt(nil) != 0 {
		t.Error("toInt")
	}
	if _, ok := toEvent(redis.XMessage{Values: map[string]any{"kind": "closed", "reason": "whatever"}}); ok {
		t.Error("closed with an unknown reason")
	}
	if _, ok := toEvent(redis.XMessage{Values: map[string]any{"kind": "other"}}); ok {
		t.Error("unknown kind")
	}
	if event, ok := toEvent(redis.XMessage{Values: map[string]any{"kind": "closed", "reason": protocol.ReasonHostTimeout}}); !ok || event.CloseReason != protocol.ReasonHostTimeout {
		t.Errorf("closed: %+v", event)
	}
}

func TestRedisEntriesWithAGapNeedTheSnapshot(t *testing.T) {
	ctx := context.Background()
	s, _ := faultyRedis(t, RedisOptions{})
	roomID := nextRoomID()
	openRoom(t, s, roomID, emptySeed())
	applyName(t, s, roomID, "one")
	applyName(t, s, roomID, "two")
	if err := s.cmd.XDel(ctx, s.Prefix(roomID)+":ops", "1-0").Err(); err != nil {
		t.Fatal(err)
	}
	if _, ok, err := s.ReadEntries(ctx, roomID, 0); ok || err != nil {
		t.Errorf("gap: %v %v", ok, err)
	}
}

func TestRedisMembersLeasesAndTouches(t *testing.T) {
	ctx := context.Background()
	s, _ := faultyRedis(t, RedisOptions{})
	roomID := nextRoomID()
	openRoom(t, s, roomID, emptySeed())
	now := NowMs()
	if err := s.TouchMembers(ctx, roomID, nil, now); err != nil {
		t.Error(err)
	}
	_, _ = s.AddMember(ctx, roomID, protocol.Participant{ClientID: "a"}, "conn", now+50, 10, now)
	if err := s.TouchMembers(ctx, roomID, []string{"a"}, now+60_000); err != nil {
		t.Fatal(err)
	}
	// Malformed member values are skipped.
	s.cmd.HSet(ctx, s.membersKey(roomID), "short", "1|x", "badjson", fmt.Sprintf("%d|c|{", now+60_000))
	list, err := s.ListMembers(ctx, roomID, now+1000)
	if err != nil || len(list) != 1 || list[0].ClientID != "a" {
		t.Errorf("members %v %v", list, err)
	}

	// Leases: a closed room's renewal is ignored, a lease of a room that is gone is dropped.
	if err := s.RenewHostLease(ctx, nextRoomID(), now); err != nil {
		t.Error(err)
	}
	ghost := nextRoomID()
	s.cmd.ZAdd(ctx, s.hostLease, redis.Z{Score: 1, Member: ghost})
	expired, err := s.ExpiredHostLeases(ctx, 2)
	if err != nil {
		t.Fatal(err)
	}
	for _, id := range expired {
		if id == ghost {
			t.Error("lease of a missing room listed")
		}
	}
	if n, _ := s.cmd.ZScore(ctx, s.hostLease, ghost).Result(); n != 0 {
		t.Error("lease of a missing room kept")
	}
}

func TestRedisExpiredLeasesFailWhenAStatusReadFails(t *testing.T) {
	ctx := context.Background()
	s, plan := faultyRedis(t, RedisOptions{})
	roomID := nextRoomID()
	openRoom(t, s, roomID, emptySeed())
	plan.Only(func(name string) bool { return name == "hget" })
	defer plan.Only(nil)
	plan.FailAt(1)
	if _, err := s.ExpiredHostLeases(ctx, NowMs()+1); !errors.Is(err, faults.ErrInjected) {
		t.Errorf("err %v", err)
	}
	plan.Off()
}

func TestRedisSkipsMalformedStreamAndPresenceMessages(t *testing.T) {
	ctx := context.Background()
	s, _ := faultyRedis(t, RedisOptions{})
	roomID := nextRoomID()
	openRoom(t, s, roomID, emptySeed())
	events := make(chan RoomEvent, 4)
	unsubscribe, err := s.Subscribe(ctx, roomID, func(e RoomEvent) { events <- e })
	if err != nil {
		t.Fatal(err)
	}
	defer unsubscribe()
	presence := make(chan PresenceEvent, 4)
	unsubscribePresence, err := s.SubscribePresence(ctx, roomID, func(e PresenceEvent) { presence <- e })
	if err != nil {
		t.Fatal(err)
	}
	defer unsubscribePresence()

	s.cmd.XAdd(ctx, &redis.XAddArgs{Stream: s.Prefix(roomID) + ":ops", ID: "1000-0", Values: map[string]any{"kind": "other"}})
	s.cmd.Publish(ctx, s.presenceChannel(roomID), "{broken")
	time.Sleep(300 * time.Millisecond) // the subscriptions settle
	s.cmd.XAdd(ctx, &redis.XAddArgs{Stream: s.Prefix(roomID) + ":ops", ID: "1001-0", Values: map[string]any{"kind": "closed", "reason": protocol.ReasonHostClosed}})
	_ = s.PublishPresence(ctx, roomID, PresenceEvent{Kind: "leave", ClientID: "c"})
	select {
	case e := <-events:
		if e.CloseReason != protocol.ReasonHostClosed {
			t.Errorf("first event %+v", e)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("no event")
	}
	select {
	case e := <-presence:
		if e.ClientID != "c" {
			t.Errorf("first presence %+v", e)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("no presence")
	}
}

func TestRedisPresenceSubscribeFailsOnAClosedSubscriber(t *testing.T) {
	s, _ := faultyRedis(t, RedisOptions{})
	_ = s.pubsub.Close()
	if _, err := s.SubscribePresence(context.Background(), nextRoomID(), func(PresenceEvent) {}); err == nil {
		t.Error("subscribed through a closed subscriber")
	}
}

type syncBuffer struct {
	mu  sync.Mutex
	buf bytes.Buffer
}

func (b *syncBuffer) Write(p []byte) (int, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.buf.Write(p)
}

func (b *syncBuffer) String() string {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.buf.String()
}

func TestRedisServerlessStoreSkipsBackgroundWork(t *testing.T) {
	s, _ := faultyRedis(t, RedisOptions{Serverless: true})
	if !s.Available() || s.pubsub != nil {
		t.Error("serverless store started background work")
	}
}

func TestRedisConnectionLifecycle(t *testing.T) {
	if _, err := NewRedis("not a url", RedisOptions{}); err == nil {
		t.Error("bad URL accepted")
	}
	if _, ok := LuaScripts()["apply.lua"]; !ok {
		t.Error("scripts not embedded")
	}
	func() {
		defer func() {
			if recover() == nil {
				t.Error("a missing script did not panic")
			}
		}()
		script("missing")
	}()

	var logged syncBuffer
	log.SetOutput(&logged)
	defer log.SetOutput(os.Stderr)
	redisHealthEvery = 10 * time.Millisecond
	defer func() { redisHealthEvery = time.Second }()
	down, err := NewRedis("redis://127.0.0.1:1", RedisOptions{Namespace: "x:"})
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	if err := down.Ready(ctx); !errors.Is(err, context.DeadlineExceeded) {
		t.Errorf("ready: %v", err)
	}
	if down.Available() {
		t.Error("unreachable Redis reported available")
	}
	if down.Namespace() != "x:" || down.Client() == nil || down.Kind() != "redis" {
		t.Error("accessors")
	}
	// The health loop has failed a ping and logged it by the time Ready gave up.
	if err := down.Close(); err != nil {
		t.Error(err)
	}
	if err := down.Close(); err != nil {
		t.Error("second close", err)
	}
	if !strings.Contains(logged.String(), "redis commands connection") {
		t.Errorf("not logged: %q", logged.String())
	}
}
