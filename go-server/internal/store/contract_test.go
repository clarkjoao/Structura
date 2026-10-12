package store

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/clarkjoao/structura/go-server/internal/protocol"
)

/*
The contract every store meets. Memory is the reference and always runs; Redis runs when
REDIS_URL is set, DynamoDB when DYNAMODB_ENDPOINT is set (DynamoDB Local).
*/

type factory struct {
	name   string
	make   func(t *testing.T) Rooms
	settle func()
}

var roomCounter atomic.Int64

func nextRoomID() string {
	return fmt.Sprintf("room-%d-%d-%d", os.Getpid(), time.Now().UnixNano(), roomCounter.Add(1))
}

func factories(t *testing.T) []factory {
	out := []factory{{
		name:   "memory",
		make:   func(t *testing.T) Rooms { return NewMemory(nil) },
		settle: func() {},
	}}
	if url := os.Getenv("REDIS_URL"); url != "" {
		out = append(out, factory{
			name: "redis",
			make: func(t *testing.T) Rooms {
				s, err := NewRedis(url, RedisOptions{Namespace: fmt.Sprintf("gotest-%d:", os.Getpid())})
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
			},
			settle: func() { time.Sleep(300 * time.Millisecond) },
		})
	}
	if extra := dynamoFactory(t); extra != nil {
		out = append(out, *extra)
	}
	return out
}

// dynamoFactory is set by dynamo_test.go.
var dynamoFactory = func(t *testing.T) *factory { return nil }

var host = protocol.User{ID: "host", Name: "Host", Color: "#000"}

func literal(t *testing.T, s string) string {
	t.Helper()
	return string(protocol.MustMarshal(s))
}

func openRoom(t *testing.T, s Rooms, roomID string, seed []byte) {
	t.Helper()
	ctx := context.Background()
	chunks := protocol.ChunkString(string(seed), 50)
	created, err := s.CreateRoom(ctx, CreateInput{RoomID: roomID, HostTokenHash: "hash", HostUser: host, SeedChunks: len(chunks), Now: NowMs()})
	if err != nil || !created {
		t.Fatalf("create: %v %v", created, err)
	}
	for i, chunk := range chunks {
		if err := s.AppendSeedChunk(ctx, roomID, i, literal(t, chunk)); err != nil {
			t.Fatal(err)
		}
	}
	result, err := s.CommitSeed(ctx, roomID)
	if err != nil || !result.OK {
		t.Fatalf("commit: %+v %v", result, err)
	}
}

func emptySeed() []byte { return protocol.MustMarshal(protocol.EmptyState()) }

type fixtureStep struct {
	Sender        string          `json:"sender"`
	SenderVersion *int64          `json:"senderVersion"`
	Patch         json.RawMessage `json:"patch"`
	Expect        string          `json:"expect"`
	Effective     json.RawMessage `json:"effective"`
}

type fixture struct {
	Name  string          `json:"name"`
	Seed  json.RawMessage `json:"seed"`
	Locks []struct {
		EntityID string `json:"entityId"`
		Holder   string `json:"holder"`
	} `json:"locks"`
	Steps        []fixtureStep   `json:"steps"`
	FinalVersion int64           `json:"finalVersion"`
	FinalState   json.RawMessage `json:"finalState"`
}

func loadFixtures(t *testing.T) []fixture {
	raw, err := os.ReadFile(filepath.Join("..", "merge", "testdata", "merge.fixtures.json"))
	if err != nil {
		t.Fatal(err)
	}
	var out []fixture
	if err := json.Unmarshal(raw, &out); err != nil {
		t.Fatal(err)
	}
	return out
}

func canonicalState(t *testing.T, raw []byte) string {
	t.Helper()
	state, ok := protocol.ParseState(raw)
	if !ok {
		t.Fatalf("not a state: %s", raw)
	}
	return sorted(state)
}

// sorted encodes a state with every collection in id order, for comparisons that ignore order.
func sorted(state protocol.State) string {
	state.Order = nil
	return string(protocol.MustMarshal(state))
}

func canonicalPatch(t *testing.T, raw []byte) string {
	t.Helper()
	patch, ok := protocol.ParsePatch(raw)
	if !ok {
		t.Fatalf("not a patch: %s", raw)
	}
	return string(protocol.MustMarshal(patch))
}

func TestContract(t *testing.T) {
	ctx := context.Background()
	for _, f := range factories(t) {
		t.Run(f.name, func(t *testing.T) {
			t.Run("merge fixtures", func(t *testing.T) {
				s := f.make(t)
				for _, fx := range loadFixtures(t) {
					t.Run(fx.Name, func(t *testing.T) {
						roomID := nextRoomID()
						openRoom(t, s, roomID, fx.Seed)
						for _, lock := range fx.Locks {
							granted, _, err := s.AcquireLock(ctx, roomID, lock.EntityID, lock.Holder, time.Minute)
							if err != nil || !granted {
								t.Fatalf("lock %v %v", granted, err)
							}
						}
						var version int64
						for i, step := range fx.Steps {
							patch, ok := protocol.ParsePatch(step.Patch)
							if !ok {
								t.Fatalf("step %d: invalid patch", i)
							}
							sv := version
							if step.SenderVersion != nil {
								sv = *step.SenderVersion
							}
							result, err := s.ApplyPatch(ctx, roomID, ApplyInput{Patch: patch, SenderVersion: sv, SenderID: step.Sender, OpID: fmt.Sprintf("op-%d", i)})
							if err != nil {
								t.Fatal(err)
							}
							if result.Status != step.Expect {
								t.Fatalf("step %d: status %s, want %s", i, result.Status, step.Expect)
							}
							if result.Status == Applied {
								version = result.Version
								if step.Effective != nil {
									got := string(protocol.MustMarshal(result.Effective))
									if want := canonicalPatch(t, step.Effective); got != want {
										t.Fatalf("step %d effective\n got %s\nwant %s", i, got, want)
									}
								}
							}
						}
						snap, err := s.ReadSnapshot(ctx, roomID)
						if err != nil || snap == nil {
							t.Fatalf("snapshot: %v", err)
						}
						if snap.Version != fx.FinalVersion {
							t.Fatalf("version %d, want %d", snap.Version, fx.FinalVersion)
						}
						if got, want := sorted(snap.State), canonicalState(t, fx.FinalState); got != want {
							t.Fatalf("state\n got %s\nwant %s", got, want)
						}
					})
				}
			})

			t.Run("refuses a second room with the same id", func(t *testing.T) {
				s := f.make(t)
				roomID := nextRoomID()
				openRoom(t, s, roomID, emptySeed())
				created, err := s.CreateRoom(ctx, CreateInput{RoomID: roomID, HostTokenHash: "x", HostUser: host, SeedChunks: 1, Now: NowMs()})
				if err != nil || created {
					t.Fatalf("created again: %v %v", created, err)
				}
			})

			t.Run("keeps a room in seeding until the commit", func(t *testing.T) {
				s := f.make(t)
				roomID := nextRoomID()
				_, _ = s.CreateRoom(ctx, CreateInput{RoomID: roomID, HostTokenHash: "h", HostUser: host, SeedChunks: 2, Now: 0})
				_ = s.AppendSeedChunk(ctx, roomID, 0, literal(t, `{"doc":{},`))
				meta, _ := s.GetMeta(ctx, roomID)
				if meta == nil || meta.Status != StatusSeeding {
					t.Fatalf("meta %+v", meta)
				}
				if snap, _ := s.ReadSnapshot(ctx, roomID); snap != nil {
					t.Fatal("served a seeding room")
				}
				patch, _ := protocol.ParsePatch([]byte(`{"doc":{"diagramName":"x"}}`))
				if r, _ := s.ApplyPatch(ctx, roomID, ApplyInput{Patch: patch, SenderID: "a", OpID: "o"}); r.Status != NotOpen {
					t.Fatalf("status %s", r.Status)
				}
			})

			t.Run("rejects an incomplete or malformed seed", func(t *testing.T) {
				s := f.make(t)
				missing := nextRoomID()
				_, _ = s.CreateRoom(ctx, CreateInput{RoomID: missing, HostTokenHash: "h", HostUser: host, SeedChunks: 2})
				_ = s.AppendSeedChunk(ctx, missing, 0, literal(t, "{}"))
				if r, _ := s.CommitSeed(ctx, missing); r.OK || r.Code != "invalid_seed" {
					t.Fatalf("missing: %+v", r)
				}
				malformed := nextRoomID()
				_, _ = s.CreateRoom(ctx, CreateInput{RoomID: malformed, HostTokenHash: "h", HostUser: host, SeedChunks: 1})
				_ = s.AppendSeedChunk(ctx, malformed, 0, literal(t, `{"doc":{},"entities":{"__proto__":{}}}`))
				if r, _ := s.CommitSeed(ctx, malformed); r.OK || r.Code != "invalid_seed" {
					t.Fatalf("malformed: %+v", r)
				}
			})

			t.Run("forgets a discarded room", func(t *testing.T) {
				s := f.make(t)
				roomID := nextRoomID()
				_, _ = s.CreateRoom(ctx, CreateInput{RoomID: roomID, HostTokenHash: "h", HostUser: host, SeedChunks: 1})
				_ = s.DiscardRoom(ctx, roomID)
				if meta, _ := s.GetMeta(ctx, roomID); meta != nil {
					t.Fatalf("meta %+v", meta)
				}
			})

			t.Run("reads a seed back exactly, across many chunks and a split surrogate pair", func(t *testing.T) {
				s := f.make(t)
				roomID := nextRoomID()
				var b strings.Builder
				b.WriteString(`{"doc":{"diagramId":"d","diagramName":"Big 🚀"},"entities":{"components":{`)
				for i := 0; i < 300; i++ {
					if i > 0 {
						b.WriteByte(',')
					}
					fmt.Fprintf(&b, `"c%d":{"id":"c%d","name":"Service %d — ✓ 🚀"}`, i, i, i)
				}
				b.WriteString(`},"connections":{},"flows":{},"iconLibrary":{},"nodeLayouts":{},"edgeLayouts":{},"versions":{}}}`)
				seed := b.String()
				// Cut like the browser: by UTF-16 units, through surrogate pairs.
				units := utf16Units(seed)
				var literals []string
				for i := 0; i < len(units); i += 37 {
					end := min(i+37, len(units))
					literals = append(literals, jsLiteral(units[i:end]))
				}
				_, _ = s.CreateRoom(ctx, CreateInput{RoomID: roomID, HostTokenHash: "h", HostUser: host, SeedChunks: len(literals)})
				for i, l := range literals {
					_ = s.AppendSeedChunk(ctx, roomID, i, l)
				}
				if r, err := s.CommitSeed(ctx, roomID); err != nil || !r.OK {
					t.Fatalf("commit %+v %v", r, err)
				}
				snap, _ := s.ReadSnapshot(ctx, roomID)
				if got, want := sorted(snap.State), canonicalState(t, []byte(seed)); got != want {
					t.Fatalf("seed changed\n got %.200s\nwant %.200s", got, want)
				}
			})

			t.Run("keeps each collection in creation order, as a JavaScript object does", func(t *testing.T) {
				s := f.make(t)
				if s.Kind() == "redis" {
					t.Skip("Redis sets keep insertion order only while small, as with the TypeScript relay")
				}
				roomID := nextRoomID()
				openRoom(t, s, roomID, []byte(`{"doc":{},"entities":{"components":{"zeta":{"n":1},"alpha":{"n":2},"mid":{"n":3}},"connections":{},"flows":{},"iconLibrary":{},"nodeLayouts":{},"edgeLayouts":{},"versions":{}}}`))
				for i, raw := range []string{
					`{"entities":{"components":{"beta":{"set":{"n":4}}}}}`,
					`{"entities":{"components":{"alpha":null}}}`,
					`{"entities":{"components":{"aaa":{"set":{"n":5}},"alpha":{"set":{"n":6}}}}}`,
				} {
					patch, _ := protocol.ParsePatch([]byte(raw))
					if _, err := s.ApplyPatch(ctx, roomID, ApplyInput{Patch: patch, SenderVersion: int64(i), SenderID: "a", OpID: fmt.Sprintf("o%d", i)}); err != nil {
						t.Fatal(err)
					}
				}
				snap, _ := s.ReadSnapshot(ctx, roomID)
				got := strings.Join(snap.State.IDs("components"), ",")
				// One patch creating two: the merge visits them in id order.
				if got != "zeta,mid,beta,aaa,alpha" {
					t.Fatalf("order %s", got)
				}
			})

			t.Run("replays exactly the entries after a version", func(t *testing.T) {
				s := f.make(t)
				roomID := nextRoomID()
				openRoom(t, s, roomID, emptySeed())
				for i := 1; i <= 5; i++ {
					patch, _ := protocol.ParsePatch([]byte(fmt.Sprintf(`{"doc":{"diagramName":"n%d"}}`, i)))
					_, _ = s.ApplyPatch(ctx, roomID, ApplyInput{Patch: patch, SenderVersion: int64(i - 1), SenderID: "a", OpID: fmt.Sprintf("o%d", i)})
				}
				entries, ok, _ := s.ReadEntries(ctx, roomID, 2)
				if !ok || len(entries) != 3 || entries[0].Version != 3 || entries[2].Version != 5 {
					t.Fatalf("entries %+v %v", entries, ok)
				}
				if entries, ok, _ := s.ReadEntries(ctx, roomID, 5); !ok || len(entries) != 0 {
					t.Fatal("expected empty catch-up")
				}
				if _, ok, _ := s.ReadEntries(ctx, roomID, 6); ok {
					t.Fatal("expected no catch-up past the version")
				}
				entries, _, _ = s.ReadEntries(ctx, roomID, 4)
				if got := string(protocol.MustMarshal(entries[0])); got != `{"version":5,"opId":"o5","sender":"a","patch":{"doc":{"diagramName":"n5"}}}` {
					t.Fatalf("entry %s", got)
				}
			})

			t.Run("grants a lock to one holder, renews it, and releases only for the holder", func(t *testing.T) {
				s := f.make(t)
				roomID := nextRoomID()
				openRoom(t, s, roomID, emptySeed())
				check := func(clientID string, granted bool, holder string) {
					t.Helper()
					g, h, err := s.AcquireLock(ctx, roomID, "n1", clientID, 10*time.Second)
					if err != nil || g != granted || h != holder {
						t.Fatalf("acquire %s: %v %q %v", clientID, g, h, err)
					}
				}
				check("a", true, "a")
				check("b", false, "a")
				check("a", true, "a")
				if ok, _ := s.ReleaseLock(ctx, roomID, "n1", "b"); ok {
					t.Fatal("b released a's lock")
				}
				if ok, _ := s.ReleaseLock(ctx, roomID, "n1", "a"); !ok {
					t.Fatal("a could not release")
				}
				check("b", true, "b")
			})

			t.Run("lets a lock lapse after its ttl", func(t *testing.T) {
				s := f.make(t)
				roomID := nextRoomID()
				openRoom(t, s, roomID, emptySeed())
				_, _, _ = s.AcquireLock(ctx, roomID, "n1", "a", 50*time.Millisecond)
				time.Sleep(120 * time.Millisecond)
				if g, h, _ := s.AcquireLock(ctx, roomID, "n1", "b", time.Second); !g || h != "b" {
					t.Fatalf("lock did not lapse: %v %s", g, h)
				}
			})

			t.Run("flips host status once", func(t *testing.T) {
				s := f.make(t)
				roomID := nextRoomID()
				openRoom(t, s, roomID, emptySeed())
				if ok, _ := s.MarkHostOffline(ctx, roomID); !ok {
					t.Fatal("first flip")
				}
				if ok, _ := s.MarkHostOffline(ctx, roomID); ok {
					t.Fatal("second flip")
				}
				if online, _ := s.IsHostOnline(ctx, roomID); online {
					t.Fatal("still online")
				}
				_ = s.MarkHostOnline(ctx, roomID)
				if online, _ := s.IsHostOnline(ctx, roomID); !online {
					t.Fatal("not back online")
				}
			})

			t.Run("closes once", func(t *testing.T) {
				s := f.make(t)
				roomID := nextRoomID()
				openRoom(t, s, roomID, emptySeed())
				var closedCount atomic.Int32
				var wg sync.WaitGroup
				for i := 0; i < 2; i++ {
					wg.Add(1)
					go func() {
						defer wg.Done()
						if ok, _ := s.CloseRoom(ctx, roomID, protocol.ReasonHostTimeout); ok {
							closedCount.Add(1)
						}
					}()
				}
				wg.Wait()
				if closedCount.Load() != 1 {
					t.Fatalf("closed %d times", closedCount.Load())
				}
				if meta, _ := s.GetMeta(ctx, roomID); meta == nil || meta.Status != StatusClosed {
					t.Fatalf("meta %+v", meta)
				}
			})

			t.Run("concurrent patches get consecutive versions", func(t *testing.T) {
				s := f.make(t)
				roomID := nextRoomID()
				openRoom(t, s, roomID, emptySeed())
				var wg sync.WaitGroup
				for i := 0; i < 20; i++ {
					wg.Add(1)
					go func(i int) {
						defer wg.Done()
						patch, _ := protocol.ParsePatch([]byte(fmt.Sprintf(`{"entities":{"nodeLayouts":{"n%d":{"set":{"x":%d}}}}}`, i, i)))
						if _, err := s.ApplyPatch(ctx, roomID, ApplyInput{Patch: patch, SenderID: "p", OpID: fmt.Sprintf("o%d", i)}); err != nil {
							t.Error(err)
						}
					}(i)
				}
				wg.Wait()
				entries, ok, _ := s.ReadEntries(ctx, roomID, 0)
				if !ok || len(entries) != 20 {
					t.Fatalf("entries %d %v", len(entries), ok)
				}
				for i, e := range entries {
					if e.Version != int64(i+1) {
						t.Fatalf("version %d at %d", e.Version, i)
					}
				}
				snap, _ := s.ReadSnapshot(ctx, roomID)
				if snap.Version != 20 || len(snap.State.Entities["nodeLayouts"]) != 20 {
					t.Fatalf("snapshot %d %d", snap.Version, len(snap.State.Entities["nodeLayouts"]))
				}
			})

			shared := func(t *testing.T) Shared {
				s, ok := f.make(t).(Shared)
				if !ok {
					t.Skip("not a shared store")
				}
				return s
			}

			t.Run("delivers entries in version order to every subscriber", func(t *testing.T) {
				s := shared(t)
				roomID := nextRoomID()
				openRoom(t, s, roomID, emptySeed())
				var mu sync.Mutex
				seen := [][]int64{{}, {}}
				for i := range seen {
					i := i
					unsub, err := s.Subscribe(ctx, roomID, func(e RoomEvent) {
						if e.Entry != nil {
							mu.Lock()
							seen[i] = append(seen[i], e.Entry.Version)
							mu.Unlock()
						}
					})
					if err != nil {
						t.Fatal(err)
					}
					defer unsub()
				}
				var wg sync.WaitGroup
				for i := 0; i < 20; i++ {
					wg.Add(1)
					go func(i int) {
						defer wg.Done()
						patch, _ := protocol.ParsePatch([]byte(fmt.Sprintf(`{"entities":{"nodeLayouts":{"n":{"set":{"x":%d}}}}}`, i)))
						_, _ = s.ApplyPatch(ctx, roomID, ApplyInput{Patch: patch, SenderID: fmt.Sprintf("p%d", i%3), OpID: fmt.Sprintf("o%d", i)})
					}(i)
				}
				wg.Wait()
				f.settle()
				mu.Lock()
				defer mu.Unlock()
				for _, list := range seen {
					if len(list) != 20 || !sort.SliceIsSorted(list, func(a, b int) bool { return list[a] < list[b] }) || list[0] != 1 {
						t.Fatalf("seen %v", list)
					}
				}
			})

			t.Run("tells subscribers why a room closed", func(t *testing.T) {
				s := shared(t)
				roomID := nextRoomID()
				openRoom(t, s, roomID, emptySeed())
				var mu sync.Mutex
				var reasons []string
				unsub, _ := s.Subscribe(ctx, roomID, func(e RoomEvent) {
					mu.Lock()
					reasons = append(reasons, e.CloseReason)
					mu.Unlock()
				})
				defer unsub()
				_, _ = s.CloseRoom(ctx, roomID, protocol.ReasonHostTimeout)
				_, _ = s.CloseRoom(ctx, roomID, protocol.ReasonHostTimeout)
				f.settle()
				mu.Lock()
				defer mu.Unlock()
				if len(reasons) != 1 || reasons[0] != protocol.ReasonHostTimeout {
					t.Fatalf("reasons %v", reasons)
				}
			})

			t.Run("enforces capacity and lets a member's own reconnect replace it", func(t *testing.T) {
				s := shared(t)
				roomID := nextRoomID()
				openRoom(t, s, roomID, emptySeed())
				member := func(id string) protocol.Participant {
					return protocol.Participant{ClientID: id, User: protocol.User{ID: id, Name: id, Color: "#111"}, Role: "guest"}
				}
				now := NowMs()
				expect := func(r AddMemberResult, ok bool, count int) {
					t.Helper()
					if r.OK != ok || (ok && r.Count != count) {
						t.Fatalf("add %+v, want ok=%v count=%d", r, ok, count)
					}
				}
				r, _ := s.AddMember(ctx, roomID, member("a"), "s1", now+30_000, 2, now)
				expect(r, true, 1)
				r, _ = s.AddMember(ctx, roomID, member("b"), "s2", now+30_000, 2, now)
				expect(r, true, 2)
				r, _ = s.AddMember(ctx, roomID, member("c"), "s3", now+30_000, 2, now)
				expect(r, false, 0)
				r, _ = s.AddMember(ctx, roomID, member("a"), "s4", now+30_000, 2, now)
				expect(r, true, 2)
				if n, _ := s.RemoveMember(ctx, roomID, "a", "s1", now); n != 2 {
					t.Fatalf("stale removal evicted the replacement: %d", n)
				}
				if n, _ := s.RemoveMember(ctx, roomID, "a", "s4", now); n != 1 {
					t.Fatalf("remove: %d", n)
				}
				list, _ := s.ListMembers(ctx, roomID, now)
				if len(list) != 1 || list[0].ClientID != "b" {
					t.Fatalf("members %+v", list)
				}
			})

			t.Run("expires members whose relay stopped renewing them", func(t *testing.T) {
				s := shared(t)
				roomID := nextRoomID()
				openRoom(t, s, roomID, emptySeed())
				now := NowMs()
				_, _ = s.AddMember(ctx, roomID, protocol.Participant{ClientID: "a", User: protocol.User{ID: "a", Name: "a", Color: "#1"}, Role: "guest"}, "s1", now+1000, 50, now)
				if l, _ := s.ListMembers(ctx, roomID, now); len(l) != 1 {
					t.Fatal("member missing")
				}
				if l, _ := s.ListMembers(ctx, roomID, now+2000); len(l) != 0 {
					t.Fatal("member did not expire")
				}
			})

			t.Run("tracks host leases", func(t *testing.T) {
				s := shared(t)
				roomID := nextRoomID()
				openRoom(t, s, roomID, emptySeed())
				now := NowMs()
				_ = s.RenewHostLease(ctx, roomID, now+5000)
				if list, _ := s.ExpiredHostLeases(ctx, now); contains(list, roomID) {
					t.Fatal("expired too early")
				}
				if list, _ := s.ExpiredHostLeases(ctx, now+6000); !contains(list, roomID) {
					t.Fatal("did not expire")
				}
			})

			t.Run("fans presence out", func(t *testing.T) {
				s := shared(t)
				roomID := nextRoomID()
				openRoom(t, s, roomID, emptySeed())
				var mu sync.Mutex
				var got []string
				unsub, _ := s.SubscribePresence(ctx, roomID, func(e PresenceEvent) {
					mu.Lock()
					got = append(got, e.Kind)
					mu.Unlock()
				})
				defer unsub()
				f.settle()
				offline := false
				_ = s.PublishPresence(ctx, roomID, PresenceEvent{Kind: "host:status", Online: &offline})
				f.settle()
				mu.Lock()
				defer mu.Unlock()
				if len(got) != 1 || got[0] != "host:status" {
					t.Fatalf("got %v", got)
				}
			})
		})
	}
}

func contains(list []string, item string) bool {
	for _, v := range list {
		if v == item {
			return true
		}
	}
	return false
}

func utf16Units(s string) []uint16 {
	units, _ := protocol.DecodeJSONStringUTF16(protocol.MustMarshal(s))
	return units
}

// jsLiteral writes code units as JSON.stringify does: lone surrogates as \uXXXX escapes.
func jsLiteral(units []uint16) string {
	var b strings.Builder
	b.WriteByte('"')
	for i := 0; i < len(units); i++ {
		u := units[i]
		switch {
		case u >= 0xD800 && u <= 0xDBFF && i+1 < len(units) && units[i+1] >= 0xDC00 && units[i+1] <= 0xDFFF:
			r := (rune(u)-0xD800)<<10 + (rune(units[i+1]) - 0xDC00) + 0x10000
			b.WriteRune(r)
			i++
		case u >= 0xD800 && u <= 0xDFFF:
			fmt.Fprintf(&b, `\u%04x`, u)
		case u == '"' || u == '\\':
			b.WriteByte('\\')
			b.WriteByte(byte(u))
		case u < 0x20:
			fmt.Fprintf(&b, `\u%04x`, u)
		default:
			b.WriteRune(rune(u))
		}
	}
	b.WriteByte('"')
	return b.String()
}

func TestContractForARoomThatDoesNotExist(t *testing.T) {
	ctx := context.Background()
	for _, f := range factories(t) {
		t.Run(f.name, func(t *testing.T) {
			s := f.make(t)
			roomID := nextRoomID()
			if r, err := s.CommitSeed(ctx, roomID); err != nil || r.Code != "not_seeding" {
				t.Errorf("commit: %+v %v", r, err)
			}
			if meta, err := s.GetMeta(ctx, roomID); meta != nil || err != nil {
				t.Errorf("meta: %+v %v", meta, err)
			}
			if snap, err := s.ReadSnapshot(ctx, roomID); snap != nil || err != nil {
				t.Errorf("snapshot: %+v %v", snap, err)
			}
			if _, ok, err := s.ReadEntries(ctx, roomID, 0); ok || err != nil {
				t.Errorf("entries: %v %v", ok, err)
			}
			if r, err := s.ApplyPatch(ctx, roomID, ApplyInput{Patch: protocol.Patch{Doc: map[string]json.RawMessage{"diagramName": json.RawMessage(`"x"`)}}, SenderID: "a", OpID: "o"}); err != nil || r.Status != NotOpen {
				t.Errorf("apply: %+v %v", r, err)
			}
			if online, err := s.IsHostOnline(ctx, roomID); online || err != nil {
				t.Errorf("host online: %v %v", online, err)
			}
			if err := s.MarkHostOnline(ctx, roomID); err != nil {
				t.Errorf("mark online: %v", err)
			}
			if online, _ := s.IsHostOnline(ctx, roomID); online {
				t.Error("marking a missing room online created it")
			}
			if changed, err := s.MarkHostOffline(ctx, roomID); changed || err != nil {
				t.Errorf("mark offline: %v %v", changed, err)
			}
			if closed, err := s.CloseRoom(ctx, roomID, protocol.ReasonHostClosed); closed || err != nil {
				t.Errorf("close: %v %v", closed, err)
			}
			if !s.Available() {
				t.Error("unavailable")
			}
		})
	}
}
