package serverless

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
	"github.com/redis/go-redis/v9"

	"github.com/clarkjoao/structura/go-server/internal/faults"
	"github.com/clarkjoao/structura/go-server/internal/protocol"
	"github.com/clarkjoao/structura/go-server/internal/store"
)

type registryBackend struct {
	name string
	// make returns the registry and the plan its calls go through.
	make func(t *testing.T) (Registry, *faults.Plan)
}

func registryBackends(t *testing.T) []registryBackend {
	var out []registryBackend
	if url := os.Getenv("REDIS_URL"); url != "" {
		out = append(out, registryBackend{"redis", func(t *testing.T) (Registry, *faults.Plan) {
			opts, err := redis.ParseURL(url)
			if err != nil {
				t.Fatal(err)
			}
			c := redis.NewClient(opts)
			t.Cleanup(func() { _ = c.Close() })
			plan := &faults.Plan{}
			c.AddHook(faults.RedisHook{Plan: plan})
			return NewRedisRegistry(c, fmt.Sprintf("reg-%d-%d:", os.Getpid(), time.Now().UnixNano())), plan
		}})
	}
	if endpoint := os.Getenv("DYNAMODB_ENDPOINT"); endpoint != "" {
		out = append(out, registryBackend{"dynamodb", func(t *testing.T) (Registry, *faults.Plan) {
			ctx := context.Background()
			db, err := store.NewDynamoClient(ctx, endpoint)
			if err != nil {
				t.Fatal(err)
			}
			table := fmt.Sprintf("reg-%d", os.Getpid())
			if err := store.EnsureTable(ctx, db, table); err != nil {
				t.Fatal(err)
			}
			plan := &faults.Plan{}
			return NewDynamoRegistry(faults.Faulty(db, plan), table, store.NowMs), plan
		}})
	}
	if len(out) == 0 {
		t.Skip("neither REDIS_URL nor DYNAMODB_ENDPOINT is set")
	}
	return out
}

func TestRegistryContract(t *testing.T) {
	ctx := context.Background()
	for _, b := range registryBackends(t) {
		t.Run(b.name, func(t *testing.T) {
			reg, _ := b.make(t)
			conn, roomID := uniq("conn"), uniq("room")

			if rec, err := reg.GetConn(ctx, conn); rec != nil || err != nil {
				t.Fatalf("missing conn: %+v %v", rec, err)
			}
			rec := ConnRecord{ConnID: conn, Phase: PhaseJoined, RoomID: roomID, ClientID: "c", Locks: []string{"e"}}
			if err := reg.PutConn(ctx, rec); err != nil {
				t.Fatal(err)
			}
			got, err := reg.GetConn(ctx, conn)
			if err != nil || got == nil || got.RoomID != roomID || got.Seq != -1 || len(got.Locks) != 1 {
				t.Fatalf("conn %+v %v", got, err)
			}
			_ = reg.AdvanceSeq(ctx, conn, 5)
			_ = reg.AdvanceSeq(ctx, conn, 3)
			if got, _ := reg.GetConn(ctx, conn); got.Seq != 5 {
				t.Errorf("seq %d", got.Seq)
			}

			if err := reg.SetDelivered(ctx, roomID, nil); err != nil {
				t.Error(err)
			}
			for _, id := range []string{conn, "other"} {
				_ = reg.PutMember(ctx, roomID, Member{ConnID: id, ClientID: id, Phase: PhaseJoined, Participant: protocol.Participant{ClientID: id}})
			}
			_ = reg.SetDelivered(ctx, roomID, map[string]int64{conn: 4})
			members, err := reg.ListMembers(ctx, roomID)
			if err != nil || len(members) != 2 {
				t.Fatalf("members %v %v", members, err)
			}
			for _, m := range members {
				if m.ConnID == conn && m.Delivered != 4 {
					t.Errorf("delivered %d", m.Delivered)
				}
			}
			if err := reg.DeleteMember(ctx, roomID, "other"); err != nil {
				t.Fatal(err)
			}
			if err := reg.DeleteMember(ctx, uniq("no-room"), "x"); err != nil {
				t.Errorf("delete in a room with no cursor: %v", err)
			}

			if got, _ := reg.AcquireLease(ctx, roomID, "a", time.Minute); !got {
				t.Error("lease to a")
			}
			if got, _ := reg.AcquireLease(ctx, roomID, "b", time.Minute); got {
				t.Error("lease to b while a holds it")
			}
			if err := reg.ReleaseLease(ctx, roomID, "b"); err != nil {
				t.Errorf("release by a non-holder: %v", err)
			}
			_ = reg.ReleaseLease(ctx, roomID, "a")
			if got, _ := reg.AcquireLease(ctx, roomID, "b", time.Minute); !got {
				t.Error("lease after release")
			}

			if since, err := reg.HostOfflineSince(ctx, roomID); since != 0 || err != nil {
				t.Errorf("online host: %d %v", since, err)
			}
			_ = reg.SetHostOffline(ctx, roomID, 1234)
			if since, _ := reg.HostOfflineSince(ctx, roomID); since != 1234 {
				t.Errorf("since %d", since)
			}
			_ = reg.ClearHostOffline(ctx, roomID)

			_ = reg.AddRoom(ctx, roomID)
			rooms, err := reg.ListRooms(ctx)
			if err != nil || !contains(rooms, roomID) {
				t.Errorf("rooms %v %v", rooms, err)
			}
			if err := reg.RemoveRoom(ctx, roomID); err != nil {
				t.Fatal(err)
			}
			if rooms, _ := reg.ListRooms(ctx); contains(rooms, roomID) {
				t.Error("room still listed")
			}
			if members, _ := reg.ListMembers(ctx, roomID); len(members) != 0 {
				t.Errorf("members left %v", members)
			}
			if err := reg.DeleteConn(ctx, conn); err != nil {
				t.Fatal(err)
			}
			if rec, _ := reg.GetConn(ctx, conn); rec != nil {
				t.Error("conn not deleted")
			}
		})
	}
}

func contains(list []string, s string) bool {
	for _, v := range list {
		if v == s {
			return true
		}
	}
	return false
}

func TestRegistryReportsEveryFailedCall(t *testing.T) {
	ctx := context.Background()
	for _, b := range registryBackends(t) {
		t.Run(b.name, func(t *testing.T) {
			reg, plan := b.make(t)
			conn, roomID := uniq("conn"), uniq("room")
			arrange := func() {
				_ = reg.PutConn(ctx, ConnRecord{ConnID: conn, Phase: PhaseJoined})
				_ = reg.PutMember(ctx, roomID, Member{ConnID: conn, Phase: PhaseJoined})
				_ = reg.SetDelivered(ctx, roomID, map[string]int64{conn: 1})
				_ = reg.SetHostOffline(ctx, roomID, 1)
				_ = reg.AddRoom(ctx, roomID)
			}
			ops := map[string]func() error{
				"get conn":      func() error { _, err := reg.GetConn(ctx, conn); return err },
				"put conn":      func() error { return reg.PutConn(ctx, ConnRecord{ConnID: conn}) },
				"delete conn":   func() error { return reg.DeleteConn(ctx, conn) },
				"advance seq":   func() error { return reg.AdvanceSeq(ctx, conn, 9) },
				"put member":    func() error { return reg.PutMember(ctx, roomID, Member{ConnID: conn}) },
				"set delivered": func() error { return reg.SetDelivered(ctx, roomID, map[string]int64{conn: 2}) },
				"delete member": func() error { return reg.DeleteMember(ctx, roomID, conn) },
				"list members":  func() error { _, err := reg.ListMembers(ctx, roomID); return err },
				"acquire lease": func() error { _, err := reg.AcquireLease(ctx, roomID, "o", time.Second); return err },
				"release lease": func() error { return reg.ReleaseLease(ctx, roomID, "o") },
				"host offline":  func() error { return reg.SetHostOffline(ctx, roomID, 2) },
				"clear offline": func() error { return reg.ClearHostOffline(ctx, roomID) },
				"offline since": func() error { _, err := reg.HostOfflineSince(ctx, roomID); return err },
				"add room":      func() error { return reg.AddRoom(ctx, roomID) },
				"remove room":   func() error { return reg.RemoveRoom(ctx, roomID) },
				"list rooms":    func() error { _, err := reg.ListRooms(ctx); return err },
			}
			// RemoveRoom's clean-up after the index is best effort.
			lenient := map[string]bool{"remove room": true}
			for name, op := range ops {
				runs := faults.Sweep(plan, arrange, op, func(n int, err error) {
					if err == nil && !(lenient[name] && n > 2) {
						t.Errorf("%s: call %d failed unreported", name, n)
					}
				})
				if runs == 0 {
					t.Errorf("%s: no call", name)
				}
			}
		})
	}
}

func TestRedisRegistrySkipsWhatItCannotRead(t *testing.T) {
	url := os.Getenv("REDIS_URL")
	if url == "" {
		t.Skip("REDIS_URL not set")
	}
	ctx := context.Background()
	opts, _ := redis.ParseURL(url)
	c := redis.NewClient(opts)
	defer c.Close()
	reg := NewRedisRegistry(c, fmt.Sprintf("reg-bad-%d:", time.Now().UnixNano()))
	conn, roomID := uniq("conn"), uniq("room")
	c.Set(ctx, reg.connKey(conn), "{broken", time.Minute)
	if _, err := reg.GetConn(ctx, conn); err == nil {
		t.Error("a broken record read")
	}
	c.HSet(ctx, reg.room(roomID, "members"), "bad", "{broken")
	if members, err := reg.ListMembers(ctx, roomID); err != nil || len(members) != 0 {
		t.Errorf("members %v %v", members, err)
	}
}

func TestDynamoRegistrySkipsWhatItCannotRead(t *testing.T) {
	endpoint := os.Getenv("DYNAMODB_ENDPOINT")
	if endpoint == "" {
		t.Skip("DYNAMODB_ENDPOINT not set")
	}
	ctx := context.Background()
	db, err := store.NewDynamoClient(ctx, endpoint)
	if err != nil {
		t.Fatal(err)
	}
	table := fmt.Sprintf("reg-%d", os.Getpid())
	if err := store.EnsureTable(ctx, db, table); err != nil {
		t.Fatal(err)
	}
	reg := NewDynamoRegistry(db, table, store.NowMs)
	conn, roomID := uniq("conn"), uniq("room")
	put := func(item map[string]types.AttributeValue) {
		if _, err := db.PutItem(ctx, &dynamodb.PutItemInput{TableName: aws.String(table), Item: item}); err != nil {
			t.Fatal(err)
		}
	}
	put(map[string]types.AttributeValue{"pk": s("c#" + conn), "sk": s("conn")})
	if _, err := reg.GetConn(ctx, conn); err == nil {
		t.Error("a record without data read")
	}
	put(map[string]types.AttributeValue{"pk": s("m#" + roomID), "sk": s("k#expired"), "data": s(`{"connId":"expired"}`), "ttl": n(1)})
	put(map[string]types.AttributeValue{"pk": s("m#" + roomID), "sk": s("k#broken"), "data": s("{broken")})
	put(map[string]types.AttributeValue{"pk": s("m#" + roomID), "sk": s("other")})
	if members, err := reg.ListMembers(ctx, roomID); err != nil || len(members) != 0 {
		t.Errorf("members %v %v", members, err)
	}
	if str(map[string]types.AttributeValue{}, "x") != "" {
		t.Error("str of a missing attribute")
	}
}
