package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"

	"github.com/clarkjoao/structura/go-server/internal/faults"
	"github.com/clarkjoao/structura/go-server/internal/merge"
	"github.com/clarkjoao/structura/go-server/internal/protocol"
)

// dynamoPair is a store whose calls fail as the plan says, and a plain store on the same table
// for arranging state behind its back.
type dynamoPair struct {
	s, plain *Dynamo
	plan     *faults.Plan
}

func newDynamoPair(t *testing.T, opts DynamoOptions, replies ...func(*dynamodb.Options)) dynamoPair {
	t.Helper()
	endpoint := os.Getenv("DYNAMODB_ENDPOINT")
	if endpoint == "" {
		t.Skip("DYNAMODB_ENDPOINT not set")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	db, err := NewDynamoClient(ctx, endpoint)
	if err != nil {
		t.Fatal(err)
	}
	table := fmt.Sprintf("gotest-%d", os.Getpid())
	if err := EnsureTable(ctx, db, table); err != nil {
		t.Fatal(err)
	}
	plan := &faults.Plan{}
	faulty := dynamodb.New(db.Options(), append([]func(*dynamodb.Options){faults.Dynamo(plan)}, replies...)...)
	return dynamoPair{s: NewDynamo(faulty, table, opts), plain: NewDynamo(db, table, DynamoOptions{}), plan: plan}
}

func patchOf(t *testing.T, raw string) protocol.Patch {
	t.Helper()
	p, ok := protocol.ParsePatch([]byte(raw))
	if !ok {
		t.Fatalf("patch %s", raw)
	}
	return p
}

// crashAfterCommit commits an entry the way a writer does and stops before materialising it, as
// a writer that crashed there would.
func crashAfterCommit(t *testing.T, d dynamoPair, roomID, raw string) {
	t.Helper()
	ctx := context.Background()
	meta, err := d.plain.readMeta(ctx, roomID)
	if err != nil || meta == nil {
		t.Fatalf("meta: %v", err)
	}
	next := meta.Version + 1
	_, err = d.plain.db.TransactWriteItems(ctx, &dynamodb.TransactWriteItemsInput{TransactItems: []types.TransactWriteItem{
		{Update: &types.Update{TableName: aws.String(d.plain.table), Key: key(metaPK(roomID), "meta"),
			UpdateExpression: aws.String("SET version = :n"), ExpressionAttributeValues: map[string]types.AttributeValue{":n": avN(next)}}},
		{Put: &types.Put{TableName: aws.String(d.plain.table), Item: map[string]types.AttributeValue{
			"pk": avS(statePK(roomID, meta.Epoch)), "sk": avS(entrySK(next)), "opId": avS("crash"), "sender": avS("x"),
			"patch": avS(string(protocol.MustMarshal(patchOf(t, raw))))}}},
	}})
	if err != nil {
		t.Fatal(err)
	}
}

func TestDynamoReportsEveryFailedCall(t *testing.T) {
	ctx := context.Background()
	d := newDynamoPair(t, DynamoOptions{})
	s := d.s
	var roomID string
	fresh := func() { roomID = nextRoomID() }
	open := func() { roomID = nextRoomID(); openRoom(t, d.plain, roomID, emptySeed()) }
	seeding := func() {
		roomID = nextRoomID()
		_, _ = d.plain.CreateRoom(ctx, CreateInput{RoomID: roomID, HostTokenHash: "h", HostUser: host, SeedChunks: 1, Now: NowMs()})
		_ = d.plain.AppendSeedChunk(ctx, roomID, 0, literal(t, `{"doc":{"diagramName":"S"},"entities":{"components":{"c1":{}},"connections":{},"flows":{},"iconLibrary":{},"nodeLayouts":{},"edgeLayouts":{},"versions":{}}}`))
	}
	withEntry := func() { open(); applyName(t, d.plain, roomID, "one") }
	crashed := func() {
		open()
		crashAfterCommit(t, d, roomID, `{"doc":{"diagramName":"x"},"entities":{"components":{"c1":{"set":{"a":1},"unset":["b"]},"c2":null}}}`)
	}
	queued := func() {
		open()
		_ = d.plain.Enqueue(ctx, roomID, QueuedPatch{ConnID: "c", ApplyInput: ApplyInput{Patch: patchOf(t, `{"doc":{"level":"q"}}`), SenderID: "a", SenderVersion: 1 << 40, OpID: "q"}})
	}
	// The cache would hide the meta read the lock calls make.
	uncached := func(setup func()) func() {
		return func() {
			setup()
			s.mu.Lock()
			s.epochs = map[string]epochCache{}
			s.mu.Unlock()
		}
	}

	sweeps := []struct {
		name  string
		setup func()
		op    func() error
	}{
		{"create", fresh, func() error { _, err := s.CreateRoom(ctx, CreateInput{RoomID: roomID, SeedChunks: 1}); return err }},
		{"append", seeding, func() error { return s.AppendSeedChunk(ctx, roomID, 1, `"x"`) }},
		{"commit", seeding, func() error { _, err := s.CommitSeed(ctx, roomID); return err }},
		{"discard", withEntry, func() error { return s.DiscardRoom(ctx, roomID) }},
		{"meta", open, func() error { _, err := s.GetMeta(ctx, roomID); return err }},
		{"apply", open, func() error {
			_, err := s.ApplyPatch(ctx, roomID, ApplyInput{Patch: patchOf(t, `{"doc":{"level":"x"},"entities":{"components":{"c9":{"set":{"a":1}}}}}`), SenderID: "a", SenderVersion: 1 << 40})
			return err
		}},
		{"apply after a crash", crashed, func() error {
			_, err := s.ApplyPatch(ctx, roomID, ApplyInput{Patch: patchOf(t, `{"doc":{"level":"y"}}`), SenderID: "a", SenderVersion: 1 << 40})
			return err
		}},
		{"snapshot", withEntry, func() error { _, err := s.ReadSnapshot(ctx, roomID); return err }},
		{"snapshot after a crash", crashed, func() error { _, err := s.ReadSnapshot(ctx, roomID); return err }},
		{"entries", withEntry, func() error { _, _, err := s.ReadEntries(ctx, roomID, 0); return err }},
		{"acquire", uncached(open), func() error { _, _, err := s.AcquireLock(ctx, roomID, "e", "c", time.Second); return err }},
		{"acquire held", uncached(func() {
			open()
			_, _, _ = d.plain.AcquireLock(ctx, roomID, "e", "other", time.Minute)
		}), func() error { _, _, err := s.AcquireLock(ctx, roomID, "e", "c", time.Second); return err }},
		{"release", uncached(open), func() error { _, err := s.ReleaseLock(ctx, roomID, "e", "c"); return err }},
		{"offline", open, func() error { _, err := s.MarkHostOffline(ctx, roomID); return err }},
		{"online", open, func() error { return s.MarkHostOnline(ctx, roomID) }},
		{"is online", open, func() error { _, err := s.IsHostOnline(ctx, roomID); return err }},
		{"offline since", open, func() error { _, err := s.HostOfflineSince(ctx, roomID); return err }},
		{"close", withEntry, func() error { _, err := s.CloseRoom(ctx, roomID, protocol.ReasonHostClosed); return err }},
		{"close reason", open, func() error { _, err := s.CloseReason(ctx, roomID); return err }},
		{"enqueue", uncached(open), func() error {
			return s.Enqueue(ctx, roomID, QueuedPatch{ApplyInput: ApplyInput{Patch: patchOf(t, `{"doc":{"level":"q"}}`)}})
		}},
		{"queue pending", uncached(open), func() error { _, err := s.QueuePending(ctx, roomID); return err }},
		{"apply queued", queued, func() error { _, err := s.ApplyQueued(ctx, roomID); return err }},
		{"apply queued after a crash", func() {
			crashed()
			_ = d.plain.Enqueue(ctx, roomID, QueuedPatch{ApplyInput: ApplyInput{Patch: patchOf(t, `{"doc":{"level":"q"}}`), SenderVersion: 1 << 40}})
		}, func() error { _, err := s.ApplyQueued(ctx, roomID); return err }},
		{"ensure table", func() {}, func() error { return EnsureTable(ctx, s.db, s.table) }},
	}
	for _, sw := range sweeps {
		// CloseRoom ignores a failed clean-up, and a failed setApplied or item write after a
		// commit is left for the next reader: those runs succeed by design.
		lenient := map[string]bool{"close": true, "apply": true, "apply after a crash": true, "apply queued": true, "apply queued after a crash": true, "snapshot after a crash": true, "ensure table": true}
		check := mustFail(t, sw.name)
		if lenient[sw.name] {
			check = func(int, error) {}
		}
		if runs := faults.Sweep(d.plan, sw.setup, sw.op, check); runs == 0 {
			t.Errorf("%s: made no call", sw.name)
		}
	}
}

func TestDynamoRoomStatesBehindTheStoresBack(t *testing.T) {
	ctx := context.Background()
	d := newDynamoPair(t, DynamoOptions{})
	s := d.s

	// An expired room is gone even before DynamoDB deletes it.
	roomID := nextRoomID()
	openRoom(t, d.plain, roomID, emptySeed())
	_, err := d.plain.db.UpdateItem(ctx, &dynamodb.UpdateItemInput{
		TableName: aws.String(s.table), Key: key(metaPK(roomID), "meta"),
		UpdateExpression:          aws.String("SET #ttl = :t"),
		ExpressionAttributeNames:  map[string]string{"#ttl": "ttl"},
		ExpressionAttributeValues: map[string]types.AttributeValue{":t": avN(1)},
	})
	if err != nil {
		t.Fatal(err)
	}
	if meta, err := s.GetMeta(ctx, roomID); meta != nil || err != nil {
		t.Errorf("expired room: %+v %v", meta, err)
	}

	// The room leaves seeding between reading the chunks and committing.
	roomID = nextRoomID()
	_, _ = d.plain.CreateRoom(ctx, CreateInput{RoomID: roomID, HostTokenHash: "h", HostUser: host, SeedChunks: 1})
	_ = d.plain.AppendSeedChunk(ctx, roomID, 0, literal(t, string(emptySeed())))
	d.plan.Only(func(name string) bool { return name == "UpdateItem" })
	d.plan.Before(func(string) { _ = d.plain.DiscardRoom(ctx, roomID) })
	r, err := s.CommitSeed(ctx, roomID)
	d.plan.Before(nil)
	d.plan.Only(nil)
	if err != nil || r.Code != "not_seeding" {
		t.Errorf("commit: %+v %v", r, err)
	}

	// The room closes while a snapshot is read.
	roomID = nextRoomID()
	openRoom(t, d.plain, roomID, emptySeed())
	d.plan.Only(func(name string) bool { return name == "Query" })
	d.plan.Before(func(string) { _, _ = d.plain.CloseRoom(ctx, roomID, protocol.ReasonHostClosed) })
	snap, err := s.ReadSnapshot(ctx, roomID)
	d.plan.Before(nil)
	d.plan.Only(nil)
	if snap != nil || err != nil {
		t.Errorf("snapshot of a room that closed: %+v %v", snap, err)
	}

	// A missing entry leaves a gap only the snapshot covers; an unreadable one is an error.
	roomID = nextRoomID()
	openRoom(t, d.plain, roomID, emptySeed())
	applyName(t, d.plain, roomID, "one")
	applyName(t, d.plain, roomID, "two")
	meta, _ := d.plain.readMeta(ctx, roomID)
	pk := statePK(roomID, meta.Epoch)
	_, _ = d.plain.db.DeleteItem(ctx, &dynamodb.DeleteItemInput{TableName: aws.String(s.table), Key: key(pk, entrySK(1))})
	if _, ok, err := s.ReadEntries(ctx, roomID, 0); ok || err != nil {
		t.Errorf("gap: %v %v", ok, err)
	}
	_, _ = d.plain.db.PutItem(ctx, &dynamodb.PutItemInput{TableName: aws.String(s.table), Item: map[string]types.AttributeValue{
		"pk": avS(pk), "sk": avS(entrySK(1)), "patch": avS("{broken"),
	}})
	if _, _, err := s.ReadEntries(ctx, roomID, 0); err == nil || err.Error() != "dynamo: unreadable entry v#000000000001" {
		t.Errorf("unreadable entry: %v", err)
	}

	// Items a snapshot cannot place are skipped.
	roomID = nextRoomID()
	openRoom(t, d.plain, roomID, emptySeed())
	meta, _ = d.plain.readMeta(ctx, roomID)
	pk = statePK(roomID, meta.Epoch)
	for _, sk := range []string{"e#nohash", "e#unknown#x"} {
		_, _ = d.plain.db.PutItem(ctx, &dynamodb.PutItemInput{TableName: aws.String(s.table), Item: map[string]types.AttributeValue{
			"pk": avS(pk), "sk": avS(sk), "v": avN(0), "f:a": avS("1"),
		}})
	}
	if snap, err := s.ReadSnapshot(ctx, roomID); err != nil || snap == nil || len(snap.State.Entities["components"]) != 0 {
		t.Errorf("snapshot with stray items: %+v %v", snap, err)
	}

	// Closed rooms tell why; a room that is gone tells nothing.
	if reason, err := s.CloseReason(ctx, nextRoomID()); reason != "" || err != nil {
		t.Errorf("reason of a missing room: %q %v", reason, err)
	}
	_, _ = s.CloseRoom(ctx, roomID, protocol.ReasonHostTimeout)
	if reason, _ := s.CloseReason(ctx, roomID); reason != protocol.ReasonHostTimeout {
		t.Errorf("reason %q", reason)
	}
	if !s.Available() || s.Close() != nil || s.Table() == "" || s.DB() == nil || s.Kind() != "dynamodb" {
		t.Error("accessors")
	}
}

func TestDynamoHostOfflineSince(t *testing.T) {
	ctx := context.Background()
	clock := int64(5000)
	d := newDynamoPair(t, DynamoOptions{Now: func() int64 { return clock }})
	roomID := nextRoomID()
	openRoom(t, d.s, roomID, emptySeed())
	if since, err := d.s.HostOfflineSince(ctx, roomID); since != 0 || err != nil {
		t.Errorf("online: %d %v", since, err)
	}
	_, _ = d.s.MarkHostOffline(ctx, roomID)
	if since, _ := d.s.HostOfflineSince(ctx, roomID); since != 5000 {
		t.Errorf("offline since %d", since)
	}
	if since, err := d.s.HostOfflineSince(ctx, nextRoomID()); since != 0 || err != nil {
		t.Errorf("missing room: %d %v", since, err)
	}
}

// Writes landing while a snapshot reads the items are replayed onto it.
func TestDynamoSnapshotReplaysWhatLandsDuringTheRead(t *testing.T) {
	ctx := context.Background()
	d := newDynamoPair(t, DynamoOptions{})
	roomID := nextRoomID()
	openRoom(t, d.plain, roomID, []byte(`{"doc":{"diagramName":"A"},"entities":{"components":{"c1":{"a":1,"b":2},"c2":{}},"connections":{},"flows":{},"iconLibrary":{},"nodeLayouts":{},"edgeLayouts":{},"versions":{}}}`))
	meta, _ := d.plain.readMeta(ctx, roomID)
	pk := statePK(roomID, meta.Epoch)
	var once sync.Once
	d.plan.Only(func(name string) bool { return name == "Query" })
	d.plan.Before(func(string) {
		once.Do(func() {
			// Two commits that never reach the items, and a doc item lost with them.
			crashAfterCommit(t, d, roomID, `{"doc":{"diagramName":"B"},"entities":{"components":{"c1":{"unset":["b"]},"c3":{"set":{"x":1}}}}}`)
			crashAfterCommit(t, d, roomID, `{"entities":{"components":{"c2":null}}}`)
			_, _ = d.plain.db.DeleteItem(ctx, &dynamodb.DeleteItemInput{TableName: aws.String(d.s.table), Key: key(pk, "doc")})
		})
	})
	snap, err := d.s.ReadSnapshot(ctx, roomID)
	d.plan.Before(nil)
	d.plan.Only(nil)
	if err != nil || snap == nil {
		t.Fatalf("snapshot: %v", err)
	}
	if snap.Version != 2 || string(snap.State.Doc["diagramName"]) != `"B"` {
		t.Errorf("version %d doc %v", snap.Version, snap.State.Doc)
	}
	got := string(protocol.MustMarshal(snap.State.Entities["components"]))
	if got != `{"c1":{"a":1},"c3":{"x":1}}` {
		t.Errorf("components %s", got)
	}
}

func TestApplyToItem(t *testing.T) {
	item := &stateItem{v: 5, fields: map[string]json.RawMessage{"a": json.RawMessage(`1`)}}
	applyToItem(item, 5, 0, &protocol.EntityPatch{Delete: true}, nil)
	if item.deleted {
		t.Error("an older entry applied")
	}
	applyToItem(item, 6, 0, nil, map[string]json.RawMessage{"diagramName": json.RawMessage(`"D"`)})
	if item.v != 6 || string(item.fields["diagramName"]) != `"D"` {
		t.Errorf("doc %+v", item)
	}
	applyToItem(item, 7, 0, &protocol.EntityPatch{Delete: true}, nil)
	if !item.deleted || len(item.fields) != 0 {
		t.Errorf("delete %+v", item)
	}
	applyToItem(item, 8, 2, &protocol.EntityPatch{Set: map[string]json.RawMessage{"x": json.RawMessage(`1`)}, Unset: []string{"y"}}, nil)
	if item.deleted || item.o != createdOrder(8, 2) || string(item.fields["x"]) != `1` {
		t.Errorf("recreate %+v", item)
	}
	if _, _, ok := splitEntitySK("e#nohash"); ok {
		t.Error("split without a collection")
	}
	if getS(map[string]types.AttributeValue{}, "x") != "" || getN(map[string]types.AttributeValue{"x": avS("1")}, "x") != 0 || getB(map[string]types.AttributeValue{}, "x") {
		t.Error("attribute helpers")
	}
}

func TestDynamoLocksUnderAMovingClock(t *testing.T) {
	ctx := context.Background()
	// Odd calls see the past, even calls the future: the holder's lock looks live to the
	// condition and expired to the check that follows, every time.
	var calls atomic.Int64
	d := newDynamoPair(t, DynamoOptions{Now: func() int64 {
		if calls.Add(1)%2 == 1 {
			return 1000
		}
		return 1 << 50
	}})
	roomID := nextRoomID()
	openRoom(t, d.plain, roomID, emptySeed())
	if ok, _, _ := d.plain.AcquireLock(ctx, roomID, "e", "holder", time.Hour); !ok {
		t.Fatal("holder")
	}
	calls.Store(0)
	if ok, holder, err := d.s.AcquireLock(ctx, roomID, "e", "c", time.Second); ok || holder != "" || err != nil {
		t.Errorf("acquire: %v %q %v", ok, holder, err)
	}
	// A cached epoch goes stale and is read again.
	d.s.mu.Lock()
	d.s.epochs[roomID] = epochCache{epoch: "old", at: time.Now().Add(-time.Minute)}
	d.s.mu.Unlock()
	if epoch, err := d.s.epoch(ctx, roomID); err != nil || epoch == "old" {
		t.Errorf("epoch %q %v", epoch, err)
	}
	if ok, err := d.s.ReleaseLock(ctx, nextRoomID(), "e", "c"); ok || err != nil {
		t.Errorf("release in a missing room: %v %v", ok, err)
	}
	if err := d.s.Enqueue(ctx, nextRoomID(), QueuedPatch{}); err != nil {
		t.Errorf("enqueue in a missing room: %v", err)
	}
}

func TestDynamoBatchCallsRetryWhatIsLeftUnprocessed(t *testing.T) {
	ctx := context.Background()
	dynamoRetryWait = time.Microsecond
	defer func() { dynamoRetryWait = 10 * time.Millisecond }()
	var left atomic.Int64
	d := newDynamoPair(t, DynamoOptions{}, faults.DynamoReplies(func(op string, in any) (any, bool) {
		if left.Load() == 0 {
			return nil, false
		}
		left.Add(-1)
		switch input := in.(type) {
		case *dynamodb.BatchWriteItemInput:
			return &dynamodb.BatchWriteItemOutput{UnprocessedItems: input.RequestItems}, true
		case *dynamodb.BatchGetItemInput:
			return &dynamodb.BatchGetItemOutput{UnprocessedKeys: input.RequestItems}, true
		}
		left.Add(1)
		return nil, false
	}))
	roomID := nextRoomID()
	openRoom(t, d.plain, roomID, emptySeed())

	// A few unprocessed rounds, then through.
	left.Store(2)
	if err := d.s.DiscardRoom(ctx, roomID); err != nil {
		t.Errorf("discard: %v", err)
	}
	left.Store(1 << 20)
	if err := d.s.batchWrite(ctx, []types.WriteRequest{{DeleteRequest: &types.DeleteRequest{Key: key("x", "y")}}}); !errors.Is(err, ErrUnavailable) {
		t.Errorf("write never processed: %v", err)
	}
	if _, err := d.s.batchGet(ctx, []map[string]types.AttributeValue{key("x", "y")}); !errors.Is(err, ErrUnavailable) {
		t.Errorf("get never processed: %v", err)
	}
	left.Store(2)
	if _, err := d.s.batchGet(ctx, []map[string]types.AttributeValue{key("x", "y")}); err != nil {
		t.Errorf("get: %v", err)
	}
	left.Store(0)
}

func TestDynamoCommitsGiveUpOnAContendedRoom(t *testing.T) {
	ctx := context.Background()
	contendedAttempts = 3
	defer func() { contendedAttempts = 200 }()
	d := newDynamoPair(t, DynamoOptions{})
	roomID := nextRoomID()
	openRoom(t, d.plain, roomID, emptySeed())
	d.plan.Only(func(name string) bool { return name == "TransactWriteItems" })
	d.plan.With(&types.TransactionCanceledException{Message: aws.String("contended")})
	d.plan.FailFrom(1)
	defer func() { d.plan.Off(); d.plan.Only(nil); d.plan.With(nil) }()
	if _, err := d.s.ApplyPatch(ctx, roomID, ApplyInput{Patch: patchOf(t, `{"doc":{"level":"x"}}`), SenderVersion: 1 << 40}); !errors.Is(err, ErrUnavailable) {
		t.Errorf("apply: %v", err)
	}
	_ = d.plain.Enqueue(ctx, roomID, QueuedPatch{ApplyInput: ApplyInput{Patch: patchOf(t, `{"doc":{"level":"x"}}`), SenderVersion: 1 << 40}})
	if _, err := d.s.ApplyQueued(ctx, roomID); !errors.Is(err, ErrUnavailable) {
		t.Errorf("apply queued: %v", err)
	}

	// A cancelled context stops the retries.
	cancelled, cancel := context.WithCancel(ctx)
	cancel()
	if err := backoff(cancelled, 1); !errors.Is(err, context.Canceled) {
		t.Errorf("backoff: %v", err)
	}
	d.plan.FailAt(1)
	if _, err := d.s.ApplyPatch(cancelled, roomID, ApplyInput{Patch: patchOf(t, `{"doc":{"level":"y"}}`), SenderVersion: 1 << 40}); err == nil {
		t.Error("apply under a cancelled context")
	}
	d.plan.FailAt(1)
	if _, err := d.s.ApplyQueued(cancelled, roomID); err == nil {
		t.Error("apply queued under a cancelled context")
	}
}

func TestDynamoQueueEdges(t *testing.T) {
	ctx := context.Background()
	d := newDynamoPair(t, DynamoOptions{})
	// A seeding room takes patches into its queue but cannot apply them: they are refused.
	roomID := nextRoomID()
	_, _ = d.plain.CreateRoom(ctx, CreateInput{RoomID: roomID, HostTokenHash: "h", HostUser: host, SeedChunks: 1})
	_ = d.s.Enqueue(ctx, roomID, QueuedPatch{ConnID: "c", ApplyInput: ApplyInput{Patch: patchOf(t, `{"doc":{"level":"x"}}`), OpID: "o"}})
	results, err := d.s.ApplyQueued(ctx, roomID)
	if err != nil || len(results) != 1 || results[0].Status != NotOpen || results[0].ConnID != "c" {
		t.Errorf("seeding room: %+v %v", results, err)
	}
	if pending, _ := d.s.QueuePending(ctx, roomID); pending {
		t.Error("refused patches left in the queue")
	}
	if results, err := d.s.ApplyQueued(ctx, nextRoomID()); results != nil || err != nil {
		t.Errorf("missing room: %v %v", results, err)
	}

	// A batch of patches that change nothing still leaves the queue.
	roomID = nextRoomID()
	openRoom(t, d.plain, roomID, emptySeed())
	applyName(t, d.plain, roomID, "same")
	_ = d.s.Enqueue(ctx, roomID, QueuedPatch{ApplyInput: ApplyInput{Patch: patchOf(t, `{"doc":{"diagramName":"same"}}`), SenderVersion: 1 << 40}})
	results, err = d.s.ApplyQueued(ctx, roomID)
	if err != nil || len(results) != 1 || results[0].Status != Noop {
		t.Errorf("noop batch: %+v %v", results, err)
	}
	if pending, _ := d.s.QueuePending(ctx, roomID); pending {
		t.Error("noop patch left in the queue")
	}

	// A slower writer never overwrites a newer item.
	meta, _ := d.plain.readMeta(ctx, roomID)
	pk := statePK(roomID, meta.Epoch)
	target := d.plain
	state := protocol.EmptyState()
	state.Doc["diagramName"] = json.RawMessage(`"stale"`)
	if err := target.writeFinal(ctx, pk, &merge.Target{State: state, Tombstones: map[string]int64{}}, map[string]int64{"doc": 0}, nil); err != nil {
		t.Errorf("stale write: %v", err)
	}
	snap, _ := d.plain.ReadSnapshot(ctx, roomID)
	if string(snap.State.Doc["diagramName"]) != `"same"` {
		t.Errorf("a stale write landed: %s", snap.State.Doc["diagramName"])
	}
}

func TestNewDynamoClientReportsABadConfiguration(t *testing.T) {
	t.Setenv("AWS_PROFILE", "structura-test-profile-that-does-not-exist")
	t.Setenv("AWS_CONFIG_FILE", os.DevNull)
	if _, err := NewDynamoClient(context.Background(), ""); err == nil {
		t.Error("a missing profile was accepted")
	}
}

func TestDynamoSnapshotFailsWhenTheReplayCannotBeRead(t *testing.T) {
	ctx := context.Background()
	d := newDynamoPair(t, DynamoOptions{})
	roomID := nextRoomID()
	openRoom(t, d.plain, roomID, emptySeed())
	var landed atomic.Bool
	d.plan.Only(func(name string) bool { return name == "Query" })
	d.plan.Before(func(string) {
		if landed.CompareAndSwap(false, true) {
			crashAfterCommit(t, d, roomID, `{"doc":{"diagramName":"B"}}`)
		}
	})
	defer func() { d.plan.Off(); d.plan.Before(nil); d.plan.Only(nil) }()
	d.plan.FailAt(2) // the read of the entries that landed
	if snap, err := d.s.ReadSnapshot(ctx, roomID); snap != nil || !errors.Is(err, faults.ErrInjected) {
		t.Errorf("snapshot: %+v %v", snap, err)
	}
}
