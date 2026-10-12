package store

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/clarkjoao/structura/go-server/internal/protocol"
)

func TestParseSeedRejectsABrokenLiteral(t *testing.T) {
	if _, ok := ParseSeed([]string{`"{\"doc\":`, `not a literal`}); ok {
		t.Error("accepted")
	}
}

func TestPresenceEventEncoding(t *testing.T) {
	holder := "h"
	cases := map[string]PresenceEvent{
		`{"kind":"lock","entityId":"e","holder":null}`: {Kind: "lock", EntityID: "e"},
		`{"kind":"lock","entityId":"e","holder":"h"}`:  {Kind: "lock", EntityID: "e", Holder: &holder},
		`{"kind":"leave","clientId":"c"}`:              {Kind: "leave", ClientID: "c"},
	}
	for want, event := range cases {
		got, err := json.Marshal(event)
		if err != nil || string(got) != want {
			t.Errorf("got %s %v, want %s", got, err, want)
		}
	}
}

// What only the reference store does: its limits are cheap to reach in memory.
func TestMemoryTrimsItsLogAndTombstones(t *testing.T) {
	ctx := context.Background()
	m := NewMemory(nil)
	if !m.Available() || m.Kind() != "memory" {
		t.Fatal("memory store unavailable")
	}
	roomID := nextRoomID()
	seed := protocol.EmptyState()
	for i := 0; i <= TombstoneLimit; i++ {
		id := fmt.Sprintf("c%d", i)
		seed.Entities["components"][id] = protocol.Entity{"id": json.RawMessage(`"` + id + `"`)}
		seed.Created("components", id)
	}
	openRoom(t, m, roomID, protocol.MustMarshal(seed))

	// One patch removes every entity: one tombstone too many.
	var removeAll protocol.Patch
	for _, id := range seed.IDs("components") {
		removeAll.Touch("components", id, &protocol.EntityPatch{Delete: true})
	}
	if r, err := m.ApplyPatch(ctx, roomID, ApplyInput{Patch: removeAll, SenderID: "a", OpID: "rm"}); err != nil || r.Status != Applied {
		t.Fatalf("remove all: %+v %v", r, err)
	}
	if n := len(m.rooms[roomID].target.Tombstones); n != TombstoneLimit {
		t.Errorf("%d tombstones kept", n)
	}

	for i := 0; i < EntryLogLimit; i++ {
		var p protocol.Patch
		p.Doc = map[string]json.RawMessage{"diagramName": json.RawMessage(fmt.Sprintf(`"n%d"`, i))}
		if _, err := m.ApplyPatch(ctx, roomID, ApplyInput{Patch: p, SenderID: "a", SenderVersion: int64(i + 1), OpID: fmt.Sprint(i)}); err != nil {
			t.Fatal(err)
		}
	}
	if n := len(m.rooms[roomID].log); n != EntryLogLimit {
		t.Errorf("log holds %d entries", n)
	}
	// Version 1 left the log: a resume from 0 needs the snapshot.
	if _, ok, err := m.ReadEntries(ctx, roomID, 0); ok || err != nil {
		t.Errorf("resume across the trimmed log: %v %v", ok, err)
	}
}

func TestMemoryAnswersForRoomsItDoesNotHave(t *testing.T) {
	ctx := context.Background()
	m := NewMemory(nil)
	if ok, holder, err := m.AcquireLock(ctx, "none", "e", "c", time.Second); ok || holder != "" || err != nil {
		t.Errorf("lock: %v %q %v", ok, holder, err)
	}
	if ok, err := m.ReleaseLock(ctx, "none", "e", "c"); ok || err != nil {
		t.Errorf("release: %v %v", ok, err)
	}
	if r, err := m.AddMember(ctx, "none", protocol.Participant{ClientID: "c"}, "conn", 1, 10, 0); r.OK || err != nil {
		t.Errorf("add member: %+v %v", r, err)
	}
	if err := m.TouchMembers(ctx, "none", []string{"c"}, 1); err != nil {
		t.Error(err)
	}
	if n, err := m.RemoveMember(ctx, "none", "c", "conn", 0); n != 0 || err != nil {
		t.Errorf("remove member: %d %v", n, err)
	}
	if list, err := m.ListMembers(ctx, "none", 0); len(list) != 0 || list == nil || err != nil {
		t.Errorf("list members: %v %v", list, err)
	}
	unsubscribe, err := m.Subscribe(ctx, "none", func(RoomEvent) { t.Error("event") })
	if err != nil {
		t.Fatal(err)
	}
	unsubscribe()
	unsubscribe, err = m.SubscribePresence(ctx, "none", func(PresenceEvent) { t.Error("presence") })
	if err != nil {
		t.Fatal(err)
	}
	unsubscribe()
}

func TestMemoryTouchesMembersAndForgetsClosedRooms(t *testing.T) {
	ctx := context.Background()
	m := NewMemory(func() int64 { return 100 })
	m.closedTTL = 10 * time.Millisecond
	roomID := nextRoomID()
	openRoom(t, m, roomID, emptySeed())
	for _, id := range []string{"b", "a"} {
		if r, _ := m.AddMember(ctx, roomID, protocol.Participant{ClientID: id}, "conn-"+id, 150, 10, 100); !r.OK {
			t.Fatalf("add %s", id)
		}
	}
	if err := m.TouchMembers(ctx, roomID, []string{"a", "ghost"}, 500); err != nil {
		t.Fatal(err)
	}
	list, _ := m.ListMembers(ctx, roomID, 200)
	if len(list) != 1 || list[0].ClientID != "a" {
		t.Errorf("after touch: %v", list)
	}

	if closed, _ := m.CloseRoom(ctx, roomID, protocol.ReasonHostClosed); !closed {
		t.Fatal("not closed")
	}
	deadline := time.Now().Add(5 * time.Second)
	for {
		meta, _ := m.GetMeta(ctx, roomID)
		if meta == nil {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("closed room never forgotten")
		}
		time.Sleep(5 * time.Millisecond)
	}

	// A room recreated under the same id outlives the old room's timer.
	again := nextRoomID()
	openRoom(t, m, again, emptySeed())
	_, _ = m.CloseRoom(ctx, again, protocol.ReasonHostClosed)
	_ = m.DiscardRoom(ctx, again)
	openRoom(t, m, again, emptySeed())
	time.Sleep(50 * time.Millisecond)
	if meta, _ := m.GetMeta(ctx, again); meta == nil {
		t.Error("the new room went with the old one's timer")
	}

	m.closedTTL = time.Hour
	_, _ = m.CloseRoom(ctx, again, protocol.ReasonHostClosed)
	if err := m.Close(); err != nil || len(m.timers) != 0 {
		t.Errorf("close: %v, %d timers", err, len(m.timers))
	}
	// After Close, closing a room starts no timer.
	openRoom(t, m, again, emptySeed())
	_, _ = m.CloseRoom(ctx, again, protocol.ReasonHostClosed)
	if len(m.timers) != 0 {
		t.Error("timer after Close")
	}
}

func TestMemoryListsMembersInJoinOrder(t *testing.T) {
	ctx := context.Background()
	m := NewMemory(nil)
	roomID := nextRoomID()
	openRoom(t, m, roomID, emptySeed())
	for _, id := range []string{"z", "a", "m"} {
		_, _ = m.AddMember(ctx, roomID, protocol.Participant{ClientID: id}, "c", 1<<40, 10, 0)
	}
	list, _ := m.ListMembers(ctx, roomID, 0)
	var ids []string
	for _, p := range list {
		ids = append(ids, p.ClientID)
	}
	if strings.Join(ids, ",") != "z,a,m" {
		t.Errorf("order %v", ids)
	}
}
