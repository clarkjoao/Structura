package store

import (
	"context"
	"fmt"
	"os"
	"sync"
	"testing"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"

	"github.com/clarkjoao/structura/go-server/internal/merge"
	"github.com/clarkjoao/structura/go-server/internal/protocol"
)

func init() {
	dynamoFactory = func(t *testing.T) *factory {
		endpoint := os.Getenv("DYNAMODB_ENDPOINT")
		if endpoint == "" {
			return nil
		}
		return &factory{
			name: "dynamodb",
			make: func(t *testing.T) Rooms {
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
				return NewDynamo(db, table, DynamoOptions{})
			},
			settle: func() {},
		}
	}
}

// A snapshot taken while patches land is exactly the state at its version: the replay of the
// seed plus entries 1..version. And an entry committed but never materialised (a crashed writer)
// still reaches the next reader.
func TestDynamoSnapshotsUnderWrites(t *testing.T) {
	endpoint := os.Getenv("DYNAMODB_ENDPOINT")
	if endpoint == "" {
		t.Skip("DYNAMODB_ENDPOINT not set")
	}
	ctx := context.Background()
	s := dynamoFactory(t).make(t).(*Dynamo)
	roomID := nextRoomID()
	openRoom(t, s, roomID, emptySeed())

	done := make(chan struct{})
	errs := make(chan error, 8)
	for w := 0; w < 4; w++ {
		go func(w int) {
			for i := 0; ; i++ {
				select {
				case <-done:
					errs <- nil
					return
				default:
				}
				raw := fmt.Sprintf(`{"entities":{"nodeLayouts":{"n%d":{"set":{"x":%d}}},"components":{"c%d":%s}}}`,
					i%7, i, i%5, map[bool]string{true: "null", false: fmt.Sprintf(`{"set":{"name":"w%d-%d"}}`, w, i)}[i%9 == 0])
				patch, _ := protocol.ParsePatch([]byte(raw))
				if _, err := s.ApplyPatch(ctx, roomID, ApplyInput{Patch: patch, SenderVersion: 1 << 40, SenderID: fmt.Sprintf("w%d", w), OpID: fmt.Sprintf("w%d-%d", w, i)}); err != nil {
					errs <- err
					return
				}
			}
		}(w)
	}
	versions := map[int64]bool{}
	for i := 0; i < 15; i++ {
		time.Sleep(40 * time.Millisecond)
		snap, err := s.ReadSnapshot(ctx, roomID)
		if err != nil {
			t.Fatal(err)
		}
		entries, _, err := s.ReadEntries(ctx, roomID, 0)
		if err != nil {
			t.Fatal(err)
		}
		replay := protocol.EmptyState()
		for _, e := range entries {
			if e.Version > snap.Version {
				break
			}
			merge.ApplyEffective(&replay, e.Patch)
		}
		if got, want := string(protocol.MustMarshal(snap.State)), string(protocol.MustMarshal(replay)); got != want {
			t.Fatalf("snapshot at %d differs from the replay\n got %s\nwant %s", snap.Version, got, want)
		}
		versions[snap.Version] = true
	}
	if len(versions) < 5 {
		t.Fatalf("writes did not overlap the snapshots: %v", versions)
	}
	close(done)
	for w := 0; w < 4; w++ {
		if err := <-errs; err != nil {
			t.Fatal(err)
		}
	}

	// A writer that committed and died before materialising.
	meta, _ := s.readMeta(ctx, roomID)
	pk := statePK(roomID, meta.Epoch)
	patch, _ := protocol.ParsePatch([]byte(`{"doc":{"diagramName":"after the crash"}}`))
	next := meta.Version + 1
	_, err := s.db.TransactWriteItems(ctx, &dynamodb.TransactWriteItemsInput{TransactItems: []types.TransactWriteItem{
		{Update: &types.Update{TableName: aws.String(s.table), Key: key(metaPK(roomID), "meta"),
			UpdateExpression: aws.String("SET version = :n"), ExpressionAttributeValues: map[string]types.AttributeValue{":n": avN(next)}}},
		{Put: &types.Put{TableName: aws.String(s.table), Item: map[string]types.AttributeValue{
			"pk": avS(pk), "sk": avS(entrySK(next)), "opId": avS("crash"), "sender": avS("x"), "patch": avS(string(protocol.MustMarshal(patch)))}}},
	}})
	if err != nil {
		t.Fatal(err)
	}
	snap, err := s.ReadSnapshot(ctx, roomID)
	if err != nil || snap.Version != next || string(snap.State.Doc["diagramName"]) != `"after the crash"` {
		t.Fatalf("snapshot %+v %v", snap, err)
	}
	if after, _ := s.readMeta(ctx, roomID); after.applied != next {
		t.Fatalf("applied %d, want %d", after.applied, next)
	}
}

// Queued patches apply once each, in queue order, even with two appliers racing.
func TestDynamoQueue(t *testing.T) {
	if os.Getenv("DYNAMODB_ENDPOINT") == "" {
		t.Skip("DYNAMODB_ENDPOINT not set")
	}
	ctx := context.Background()
	s := dynamoFactory(t).make(t).(*Dynamo)
	roomID := nextRoomID()
	openRoom(t, s, roomID, emptySeed())
	const total = 120
	for i := 0; i < total; i++ {
		patch, _ := protocol.ParsePatch([]byte(fmt.Sprintf(`{"entities":{"nodeLayouts":{"n%d":{"set":{"x":%d}}}}}`, i%4, i)))
		if err := s.Enqueue(ctx, roomID, QueuedPatch{ConnID: "c", ApplyInput: ApplyInput{Patch: patch, SenderVersion: 1 << 40, SenderID: "a", OpID: fmt.Sprintf("op-%d", i)}}); err != nil {
			t.Fatal(err)
		}
	}
	var mu sync.Mutex
	seen := map[string]int{}
	var wg sync.WaitGroup
	for w := 0; w < 2; w++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for {
				results, err := s.ApplyQueued(ctx, roomID)
				if err != nil {
					t.Error(err)
					return
				}
				if len(results) == 0 {
					return
				}
				mu.Lock()
				for _, r := range results {
					seen[r.OpID]++
				}
				mu.Unlock()
			}
		}()
	}
	wg.Wait()
	if len(seen) != total {
		t.Fatalf("answered %d of %d", len(seen), total)
	}
	for op, n := range seen {
		if n != 1 {
			t.Fatalf("%s answered %d times", op, n)
		}
	}
	entries, ok, _ := s.ReadEntries(ctx, roomID, 0)
	if !ok || len(entries) != total {
		t.Fatalf("entries %d", len(entries))
	}
	for i, e := range entries {
		if e.OpID != fmt.Sprintf("op-%d", i) {
			t.Fatalf("entry %d is %s: queue order lost", i, e.OpID)
		}
	}
	snap, _ := s.ReadSnapshot(ctx, roomID)
	for n := 0; n < 4; n++ {
		want := fmt.Sprint(total - 4 + n)
		if got := string(snap.State.Entities["nodeLayouts"][fmt.Sprintf("n%d", n)]["x"]); got != want {
			t.Fatalf("n%d.x = %s, want %s", n, got, want)
		}
	}
	if pending, _ := s.QueuePending(ctx, roomID); pending {
		t.Fatal("queue not empty")
	}
}
