package store

import (
	"context"
	"embed"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/redis/go-redis/v9"

	"github.com/clarkjoao/structura/go-server/internal/protocol"
)

/*
Redis keeps rooms with the TypeScript relay's layout and Lua scripts, so both relays can serve one
Redis during a migration. Every key of a room carries the `{roomId}` hash tag:

	c:{r}:meta             Hash    status, version, epoch, hostTokenHash, hostUser, seedChunks, createdAt, hostOnline
	c:{r}:doc              Hash    doc field → JSON
	c:{r}:idx:<coll>       Set     entity ids
	c:{r}:e:<coll>:<id>    Hash    field → JSON ("" is a presence marker)
	c:{r}:tomb             Hash    <coll>/<id> → version of the removal
	c:{r}:ops              Stream  <version>-0: kind=entry opId sender patch; <version>-1: kind=closed reason
	c:{r}:lock:<id>        String  holder, PX ttl
	c:{r}:seed             Hash    chunk index → chunk
	c:{r}:members          Hash    clientId → "<expiresAt>|<connId>|<participant>"
	c:{r}:presence         channel ephemeral events
	collab:hostlease       ZSet    roomId → host lease expiry

Seed chunks are the one difference: this relay stores each chunk as its JSON string literal (see
ParseSeed). A seed is committed by the relay that received it, so the two never read each other's.
*/

//go:embed lua/*.lua
var luaFiles embed.FS

// LuaScripts returns the embedded scripts by name (tests compare them with the TS relay's).
func LuaScripts() map[string]string {
	out := map[string]string{}
	entries, _ := luaFiles.ReadDir("lua")
	for _, entry := range entries {
		body, _ := luaFiles.ReadFile("lua/" + entry.Name())
		out[entry.Name()] = string(body)
	}
	return out
}

func script(name string) *redis.Script {
	body, err := luaFiles.ReadFile("lua/" + name + ".lua")
	if err != nil {
		panic(err)
	}
	return redis.NewScript(string(body))
}

var (
	scriptApply       = script("apply")
	scriptSeedCommit  = script("seed-commit")
	scriptSnapshot    = script("snapshot")
	scriptClose       = script("close")
	scriptDiscard     = script("discard")
	scriptMembers     = script("members")
	scriptLock        = script("lock")
	scriptHostOffline = script("host-offline")
)

// redisHealthEvery is how often a long-lived store pings Redis.
var redisHealthEvery = time.Second

const (
	readBlock = 100 * time.Millisecond
	// seedBatchEntities bounds how long one seed-commit call holds Redis.
	seedBatchEntities = 200
)

// Redis is a store any number of relays share.
type Redis struct {
	cmd       *redis.Client
	reader    *redis.Client
	namespace string
	hostLease string
	now       func() int64
	available atomic.Bool
	stop      chan struct{}
	every     time.Duration
	// loops are the background goroutines; Close waits for them.
	loops sync.WaitGroup

	mu        sync.Mutex
	watches   map[string]*streamWatch
	readerOn  bool
	presence  map[string]map[int]func(PresenceEvent)
	pubsub    *redis.PubSub
	nextID    int
	closed    bool
	lastError time.Time
}

type streamWatch struct {
	lastID    string
	listeners map[int]func(RoomEvent)
}

// RedisOptions configures a Redis store.
type RedisOptions struct {
	// Namespace is prepended to every key, so deployments can share one Redis.
	Namespace string
	Now       func() int64
	// Serverless skips the background work a long-lived relay needs (presence subscriber,
	// health pings): a Lambda container is frozen between invocations.
	Serverless bool
}

// NewRedis connects to url (redis://…). Commands fail fast while Redis is unreachable: an edit
// applied seconds later, to a room that may have been recreated meanwhile, is worse than an edit
// refused now.
func NewRedis(url string, opts RedisOptions) (*Redis, error) {
	options, err := redis.ParseURL(url)
	if err != nil {
		return nil, err
	}
	options.MaxRetries = 1
	options.DialTimeout = 2 * time.Second
	options.ReadTimeout = 2 * time.Second
	options.WriteTimeout = 2 * time.Second
	readerOptions := *options
	readerOptions.ReadTimeout = readBlock + 2*time.Second
	readerOptions.PoolSize = 2
	now := opts.Now
	if now == nil {
		now = NowMs
	}
	s := &Redis{
		cmd:       redis.NewClient(options),
		reader:    redis.NewClient(&readerOptions),
		namespace: opts.Namespace,
		hostLease: opts.Namespace + "collab:hostlease",
		now:       now,
		stop:      make(chan struct{}),
		every:     redisHealthEvery,
		watches:   map[string]*streamWatch{},
		presence:  map[string]map[int]func(PresenceEvent){},
	}
	if opts.Serverless {
		s.available.Store(true)
		return s, nil
	}
	s.pubsub = s.cmd.Subscribe(context.Background())
	s.loops.Add(2)
	go func() { defer s.loops.Done(); s.presenceLoop() }()
	go func() { defer s.loops.Done(); s.healthLoop() }()
	return s, nil
}

// Ready waits until the command connection answers.
func (s *Redis) Ready(ctx context.Context) error {
	for {
		if err := s.cmd.Ping(ctx).Err(); err == nil {
			s.available.Store(true)
			return nil
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(100 * time.Millisecond):
		}
	}
}

func (s *Redis) healthLoop() {
	ticker := time.NewTicker(s.every)
	defer ticker.Stop()
	for {
		ctx, cancel := context.WithTimeout(context.Background(), time.Second)
		err := s.cmd.Ping(ctx).Err()
		cancel()
		s.available.Store(err == nil)
		if err != nil {
			s.reportError("commands", err)
		}
		select {
		case <-s.stop:
			return
		case <-ticker.C:
		}
	}
}

func (s *Redis) reportError(role string, err error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.closed || time.Since(s.lastError) < 5*time.Second {
		return
	}
	s.lastError = time.Now()
	log.Printf("[collab] redis %s connection: %v", role, err)
}

func (s *Redis) Kind() string    { return "redis" }
func (s *Redis) Available() bool { return s.available.Load() }

// Client exposes the command connection (the serverless registry shares it).
func (s *Redis) Client() *redis.Client { return s.cmd }

// Prefix is the key prefix of a room.
func (s *Redis) Prefix(roomID string) string { return s.namespace + "c:{" + roomID + "}" }

// Namespace is the deployment's key prefix.
func (s *Redis) Namespace() string { return s.namespace }

func (s *Redis) run(ctx context.Context, sc *redis.Script, args ...any) (any, error) {
	return sc.Run(ctx, s.cmd, nil, args...).Result()
}

// ── Wire form: values travel to Lua JSON-encoded, so Lua never re-encodes ──

func toWire(patch protocol.Patch) string {
	doc := make([][2]string, 0, len(patch.Doc))
	for _, field := range protocol.DocFields {
		if value, ok := patch.Doc[field]; ok {
			doc = append(doc, [2]string{field, string(value)})
		}
	}
	ent := make([]any, 0)
	for _, collection := range protocol.Collections {
		byID := patch.Entities[collection]
		for _, id := range patch.IDs(collection) {
			entityPatch := byID[id]
			if entityPatch == nil || entityPatch.Delete {
				ent = append(ent, []any{collection, id, 1, []any{}, []any{}})
				continue
			}
			sets := make([]any, 0, len(entityPatch.Set))
			for _, field := range sortedIDs(entityPatch.Set) {
				sets = append(sets, []string{field, string(entityPatch.Set[field])})
			}
			unsets := make([]any, 0, len(entityPatch.Unset))
			for _, field := range entityPatch.Unset {
				unsets = append(unsets, field)
			}
			ent = append(ent, []any{collection, id, 0, sets, unsets})
		}
	}
	return string(protocol.MustMarshal(map[string]any{"doc": doc, "ent": ent}))
}

// asList reads a JSON array; cjson encodes an empty Lua table as {}, read as an empty list.
func asList(raw json.RawMessage) []json.RawMessage {
	var out []json.RawMessage
	if err := json.Unmarshal(raw, &out); err != nil {
		return nil
	}
	return out
}

func asString(raw json.RawMessage) string {
	var s string
	_ = json.Unmarshal(raw, &s)
	return s
}

func fromWire(text string) protocol.Patch {
	var wire struct {
		Doc json.RawMessage `json:"doc"`
		Ent json.RawMessage `json:"ent"`
	}
	var patch protocol.Patch
	if json.Unmarshal([]byte(text), &wire) != nil {
		return patch
	}
	for _, pair := range asList(wire.Doc) {
		parts := asList(pair)
		if len(parts) < 2 {
			continue
		}
		field := asString(parts[0])
		if !protocol.IsDocField(field) {
			continue
		}
		if patch.Doc == nil {
			patch.Doc = map[string]json.RawMessage{}
		}
		patch.Doc[field] = json.RawMessage(asString(parts[1]))
	}
	for _, item := range asList(wire.Ent) {
		parts := asList(item)
		if len(parts) < 5 {
			continue
		}
		collection, id := asString(parts[0]), asString(parts[1])
		if !protocol.IsCollection(collection) {
			continue
		}
		if string(parts[2]) == "1" {
			patch.Touch(collection, id, &protocol.EntityPatch{Delete: true})
			continue
		}
		out := &protocol.EntityPatch{}
		for _, pair := range asList(parts[3]) {
			fv := asList(pair)
			if len(fv) < 2 {
				continue
			}
			if out.Set == nil {
				out.Set = map[string]json.RawMessage{}
			}
			out.Set[asString(fv[0])] = json.RawMessage(asString(fv[1]))
		}
		for _, field := range asList(parts[4]) {
			out.Unset = append(out.Unset, asString(field))
		}
		patch.Touch(collection, id, out)
	}
	return patch
}

func sortedIDs[V any](m map[string]V) []string { return sortedKeysOf(m) }

// ── Rooms ───────────────────────────────────────────────────────────────────

func (s *Redis) CreateRoom(ctx context.Context, in CreateInput) (bool, error) {
	meta := s.Prefix(in.RoomID) + ":meta"
	created, err := s.cmd.HSetNX(ctx, meta, "status", StatusSeeding).Result()
	if err != nil || !created {
		return false, err
	}
	err = s.cmd.HSet(ctx, meta,
		"version", 0,
		"hostTokenHash", in.HostTokenHash,
		"hostUser", string(protocol.MustMarshal(in.HostUser)),
		"seedChunks", in.SeedChunks,
		"createdAt", in.Now,
		"hostOnline", "1",
		"epoch", NewEpoch(),
	).Err()
	if err != nil {
		return false, err
	}
	return true, s.cmd.ZAdd(ctx, s.hostLease, redis.Z{Score: float64(in.Now), Member: in.RoomID}).Err()
}

func (s *Redis) AppendSeedChunk(ctx context.Context, roomID string, index int, literal string) error {
	return s.cmd.HSet(ctx, s.Prefix(roomID)+":seed", strconv.Itoa(index), literal).Err()
}

func (s *Redis) CommitSeed(ctx context.Context, roomID string) (CommitResult, error) {
	meta, err := s.GetMeta(ctx, roomID)
	if err != nil {
		return CommitResult{}, err
	}
	if meta == nil || meta.Status != StatusSeeding {
		return CommitResult{Code: "not_seeding"}, nil
	}
	chunks, err := s.cmd.HGetAll(ctx, s.Prefix(roomID)+":seed").Result()
	if err != nil {
		return CommitResult{}, err
	}
	literals := make([]string, meta.SeedChunks)
	for i := range literals {
		part, ok := chunks[strconv.Itoa(i)]
		if !ok {
			return CommitResult{Code: "invalid_seed"}, nil
		}
		literals[i] = part
	}
	state, ok := ParseSeed(literals)
	if !ok {
		return CommitResult{Code: "invalid_seed"}, nil
	}
	doc := make([][2]string, 0, len(state.Doc))
	for _, field := range sortedKeysOf(state.Doc) {
		doc = append(doc, [2]string{field, string(state.Doc[field])})
	}
	var ent []any
	for _, collection := range protocol.Collections {
		for _, id := range state.IDs(collection) {
			entity := state.Entities[collection][id]
			fields := make([]any, 0, len(entity))
			for _, f := range sortedKeysOf(entity) {
				fields = append(fields, []string{f, string(entity[f])})
			}
			ent = append(ent, []any{collection, id, fields})
		}
	}
	batches := (len(ent) + seedBatchEntities - 1) / seedBatchEntities
	if batches == 0 {
		batches = 1
	}
	for b := 0; b < batches; b++ {
		batchDoc := [][2]string{}
		if b == 0 {
			batchDoc = doc
		}
		end := min((b+1)*seedBatchEntities, len(ent))
		batchEnt := []any{}
		if b*seedBatchEntities < end {
			batchEnt = ent[b*seedBatchEntities : end]
		}
		last := "0"
		if b == batches-1 {
			last = "1"
		}
		written, err := s.run(ctx, scriptSeedCommit, s.Prefix(roomID),
			string(protocol.MustMarshal(map[string]any{"doc": batchDoc, "ent": batchEnt})), last)
		if err != nil {
			return CommitResult{}, err
		}
		if n, _ := written.(int64); n != 1 {
			return CommitResult{Code: "not_seeding"}, nil
		}
	}
	return CommitResult{OK: true}, nil
}

func collectionsJSON() string { return string(protocol.MustMarshal(protocol.Collections)) }

func (s *Redis) DiscardRoom(ctx context.Context, roomID string) error {
	_, err := s.run(ctx, scriptDiscard, s.Prefix(roomID), collectionsJSON(), roomID, s.hostLease)
	return err
}

func (s *Redis) GetMeta(ctx context.Context, roomID string) (*Meta, error) {
	raw, err := s.cmd.HGetAll(ctx, s.Prefix(roomID)+":meta").Result()
	if err != nil {
		return nil, err
	}
	if raw["status"] == "" {
		return nil, nil
	}
	status := StatusSeeding
	if raw["status"] == StatusOpen || raw["status"] == StatusClosed {
		status = raw["status"]
	}
	var user protocol.User
	_ = json.Unmarshal([]byte(raw["hostUser"]), &user)
	version, _ := strconv.ParseInt(raw["version"], 10, 64)
	chunks, _ := strconv.Atoi(raw["seedChunks"])
	created, _ := strconv.ParseInt(raw["createdAt"], 10, 64)
	return &Meta{
		RoomID:        roomID,
		Status:        status,
		Version:       version,
		HostTokenHash: raw["hostTokenHash"],
		HostUser:      user,
		SeedChunks:    chunks,
		CreatedAt:     created,
		Epoch:         raw["epoch"],
	}, nil
}

var guardedJSON = string(protocol.MustMarshal(protocol.LockGuardedFields))

func immutableJSON() string {
	fields := make([]string, 0, len(protocol.ImmutableDocFields))
	for f := range protocol.ImmutableDocFields {
		fields = append(fields, f)
	}
	return string(protocol.MustMarshal(fields))
}

func (s *Redis) ApplyPatch(ctx context.Context, roomID string, in ApplyInput) (ApplyResult, error) {
	raw, err := s.run(ctx, scriptApply,
		s.Prefix(roomID),
		toWire(in.Patch),
		in.SenderVersion,
		in.SenderID,
		in.OpID,
		guardedJSON,
		immutableJSON(),
		EntryLogLimit,
	)
	if err != nil {
		return ApplyResult{}, err
	}
	list, _ := raw.([]any)
	if len(list) == 0 {
		return ApplyResult{Status: NotOpen}, nil
	}
	switch list[0] {
	case Applied:
		return ApplyResult{Status: Applied, Version: toInt(list[1]), Effective: fromWire(fmt.Sprint(list[2]))}, nil
	case Noop:
		return ApplyResult{Status: Noop, Version: toInt(list[1])}, nil
	}
	return ApplyResult{Status: NotOpen}, nil
}

func toInt(v any) int64 {
	switch t := v.(type) {
	case int64:
		return t
	case string:
		n, _ := strconv.ParseInt(t, 10, 64)
		return n
	}
	return 0
}

func flatToEntity(flat any) protocol.Entity {
	list, _ := flat.([]any)
	entity := protocol.Entity{}
	for i := 0; i+1 < len(list); i += 2 {
		field := fmt.Sprint(list[i])
		if field == "" {
			continue
		}
		entity[field] = json.RawMessage(fmt.Sprint(list[i+1]))
	}
	return entity
}

func (s *Redis) ReadSnapshot(ctx context.Context, roomID string) (*Snapshot, error) {
	raw, err := s.run(ctx, scriptSnapshot, s.Prefix(roomID), collectionsJSON())
	if errors.Is(err, redis.Nil) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	list, _ := raw.([]any)
	if len(list) < 3 {
		return nil, nil
	}
	state := protocol.EmptyState()
	for field, value := range flatToEntity(list[1]) {
		if protocol.IsDocField(field) {
			state.Doc[field] = value
		}
	}
	collections, _ := list[2].([]any)
	for _, item := range collections {
		pair, _ := item.([]any)
		if len(pair) < 2 {
			continue
		}
		collection := fmt.Sprint(pair[0])
		if !protocol.IsCollection(collection) {
			continue
		}
		entities, _ := pair[1].([]any)
		for _, e := range entities {
			idFlat, _ := e.([]any)
			if len(idFlat) < 2 {
				continue
			}
			id := fmt.Sprint(idFlat[0])
			state.Entities[collection][id] = flatToEntity(idFlat[1])
			state.Created(collection, id)
		}
	}
	return &Snapshot{Version: toInt(list[0]), State: state}, nil
}

func versionOfID(id string) int64 {
	n, _ := strconv.ParseInt(strings.SplitN(id, "-", 2)[0], 10, 64)
	return n
}

func toEvent(message redis.XMessage) (RoomEvent, bool) {
	kind, _ := message.Values["kind"].(string)
	switch kind {
	case "closed":
		reason, _ := message.Values["reason"].(string)
		if reason != protocol.ReasonHostClosed && reason != protocol.ReasonHostTimeout {
			return RoomEvent{}, false
		}
		return RoomEvent{CloseReason: reason}, true
	case "entry":
		opID, _ := message.Values["opId"].(string)
		sender, _ := message.Values["sender"].(string)
		patch, _ := message.Values["patch"].(string)
		return RoomEvent{Entry: &protocol.Entry{
			Version: versionOfID(message.ID),
			OpID:    opID,
			Sender:  sender,
			Patch:   fromWire(patch),
		}}, true
	}
	return RoomEvent{}, false
}

func (s *Redis) ReadEntries(ctx context.Context, roomID string, from int64) ([]protocol.Entry, bool, error) {
	meta, err := s.GetMeta(ctx, roomID)
	if err != nil {
		return nil, false, err
	}
	if meta == nil || meta.Status != StatusOpen || from > meta.Version {
		return nil, false, nil
	}
	if from == meta.Version {
		return []protocol.Entry{}, true, nil
	}
	rows, err := s.cmd.XRange(ctx, s.Prefix(roomID)+":ops", fmt.Sprintf("(%d-0", from), "+").Result()
	if err != nil {
		return nil, false, err
	}
	entries := make([]protocol.Entry, 0, len(rows))
	for _, row := range rows {
		if event, ok := toEvent(row); ok && event.Entry != nil {
			entries = append(entries, *event.Entry)
		}
	}
	if len(entries) == 0 || entries[0].Version != from+1 {
		return nil, false, nil
	}
	return entries, true, nil
}

func (s *Redis) AcquireLock(ctx context.Context, roomID, entityID, clientID string, ttl time.Duration) (bool, string, error) {
	raw, err := s.run(ctx, scriptLock, s.Prefix(roomID)+":lock:"+entityID, "acquire", clientID, ttl.Milliseconds())
	if err != nil {
		return false, "", err
	}
	list, _ := raw.([]any)
	if len(list) < 2 {
		return false, "", nil
	}
	holder, _ := list[1].(string)
	return toInt(list[0]) == 1, holder, nil
}

func (s *Redis) ReleaseLock(ctx context.Context, roomID, entityID, clientID string) (bool, error) {
	raw, err := s.run(ctx, scriptLock, s.Prefix(roomID)+":lock:"+entityID, "release", clientID)
	if err != nil {
		return false, err
	}
	return toInt(raw) == 1, nil
}

func (s *Redis) MarkHostOffline(ctx context.Context, roomID string) (bool, error) {
	raw, err := s.run(ctx, scriptHostOffline, s.Prefix(roomID)+":meta")
	if err != nil {
		return false, err
	}
	return toInt(raw) == 1, nil
}

func (s *Redis) MarkHostOnline(ctx context.Context, roomID string) error {
	meta := s.Prefix(roomID) + ":meta"
	exists, err := s.cmd.Exists(ctx, meta).Result()
	if err != nil || exists != 1 {
		return err
	}
	return s.cmd.HSet(ctx, meta, "hostOnline", "1").Err()
}

func (s *Redis) IsHostOnline(ctx context.Context, roomID string) (bool, error) {
	value, err := s.cmd.HGet(ctx, s.Prefix(roomID)+":meta", "hostOnline").Result()
	if errors.Is(err, redis.Nil) {
		return false, nil
	}
	return value == "1", err
}

func (s *Redis) CloseRoom(ctx context.Context, roomID, reason string) (bool, error) {
	raw, err := s.run(ctx, scriptClose, s.Prefix(roomID), reason, collectionsJSON(),
		ClosedRoomTTL.Milliseconds(), roomID, s.hostLease)
	if err != nil {
		return false, err
	}
	return toInt(raw) == 1, nil
}

func (s *Redis) Close() error {
	s.mu.Lock()
	if s.closed {
		s.mu.Unlock()
		return nil
	}
	s.closed = true
	s.watches = map[string]*streamWatch{}
	s.presence = map[string]map[int]func(PresenceEvent){}
	s.mu.Unlock()
	close(s.stop)
	if s.pubsub != nil {
		_ = s.pubsub.Close()
	}
	_ = s.reader.Close()
	err := s.cmd.Close()
	s.loops.Wait()
	return err
}

// ── Shared ──────────────────────────────────────────────────────────────────

func (s *Redis) membersKey(roomID string) string { return s.Prefix(roomID) + ":members" }

func (s *Redis) AddMember(ctx context.Context, roomID string, member protocol.Participant, connID string, expiresAt int64, max int, now int64) (AddMemberResult, error) {
	raw, err := s.run(ctx, scriptMembers, s.membersKey(roomID), "add", now, member.ClientID, connID,
		expiresAt, max, string(protocol.MustMarshal(member)))
	if err != nil {
		return AddMemberResult{}, err
	}
	list, _ := raw.([]any)
	if len(list) < 2 {
		return AddMemberResult{}, nil
	}
	return AddMemberResult{OK: toInt(list[0]) == 1, Count: int(toInt(list[1]))}, nil
}

func (s *Redis) TouchMembers(ctx context.Context, roomID string, clientIDs []string, expiresAt int64) error {
	if len(clientIDs) == 0 {
		return nil
	}
	args := []any{s.membersKey(roomID), "touch", s.now(), expiresAt}
	for _, id := range clientIDs {
		args = append(args, id)
	}
	_, err := s.run(ctx, scriptMembers, args...)
	return err
}

func (s *Redis) RemoveMember(ctx context.Context, roomID, clientID, connID string, now int64) (int, error) {
	raw, err := s.run(ctx, scriptMembers, s.membersKey(roomID), "remove", now, clientID, connID)
	if err != nil {
		return 0, err
	}
	return int(toInt(raw)), nil
}

type memberValue struct {
	expiresAt   int64
	connID      string
	participant protocol.Participant
}

func parseMember(value string) (memberValue, bool) {
	parts := strings.SplitN(value, "|", 3)
	if len(parts) < 3 {
		return memberValue{}, false
	}
	expiresAt, _ := strconv.ParseInt(parts[0], 10, 64)
	var participant protocol.Participant
	if json.Unmarshal([]byte(parts[2]), &participant) != nil {
		return memberValue{}, false
	}
	return memberValue{expiresAt: expiresAt, connID: parts[1], participant: participant}, true
}

func (s *Redis) ListMembers(ctx context.Context, roomID string, now int64) ([]protocol.Participant, error) {
	raw, err := s.cmd.HGetAll(ctx, s.membersKey(roomID)).Result()
	if err != nil {
		return nil, err
	}
	out := []protocol.Participant{}
	for _, clientID := range sortedKeysOf(raw) {
		member, ok := parseMember(raw[clientID])
		if ok && member.expiresAt > now {
			out = append(out, member.participant)
		}
	}
	return out, nil
}

func (s *Redis) RenewHostLease(ctx context.Context, roomID string, expiresAt int64) error {
	status, err := s.cmd.HGet(ctx, s.Prefix(roomID)+":meta", "status").Result()
	if errors.Is(err, redis.Nil) || status == StatusClosed {
		return nil
	}
	if err != nil {
		return err
	}
	return s.cmd.ZAdd(ctx, s.hostLease, redis.Z{Score: float64(expiresAt), Member: roomID}).Err()
}

func (s *Redis) ExpiredHostLeases(ctx context.Context, before int64) ([]string, error) {
	rooms, err := s.cmd.ZRangeByScore(ctx, s.hostLease, &redis.ZRangeBy{Min: "-inf", Max: fmt.Sprintf("(%d", before)}).Result()
	if err != nil {
		return nil, err
	}
	var live []string
	for _, roomID := range rooms {
		status, err := s.cmd.HGet(ctx, s.Prefix(roomID)+":meta", "status").Result()
		if errors.Is(err, redis.Nil) || status == StatusClosed {
			s.cmd.ZRem(ctx, s.hostLease, roomID)
			continue
		}
		if err != nil {
			return nil, err
		}
		live = append(live, roomID)
	}
	return live, nil
}

func (s *Redis) Subscribe(ctx context.Context, roomID string, listener func(RoomEvent)) (Unsubscribe, error) {
	s.mu.Lock()
	watch := s.watches[roomID]
	s.mu.Unlock()
	if watch == nil {
		raw, err := s.cmd.HGet(ctx, s.Prefix(roomID)+":meta", "version").Result()
		if err != nil && !errors.Is(err, redis.Nil) {
			return nil, err
		}
		version, _ := strconv.ParseInt(raw, 10, 64)
		s.mu.Lock()
		if s.watches[roomID] == nil {
			s.watches[roomID] = &streamWatch{lastID: fmt.Sprintf("%d-0", version), listeners: map[int]func(RoomEvent){}}
		}
		watch = s.watches[roomID]
		s.mu.Unlock()
	}
	s.mu.Lock()
	s.nextID++
	id := s.nextID
	watch.listeners[id] = listener
	if !s.readerOn && !s.closed {
		s.readerOn = true
		s.loops.Add(1)
		go func() { defer s.loops.Done(); s.readLoop() }()
	}
	s.mu.Unlock()
	return func() {
		s.mu.Lock()
		defer s.mu.Unlock()
		if current := s.watches[roomID]; current != nil {
			delete(current.listeners, id)
			if len(current.listeners) == 0 {
				delete(s.watches, roomID)
			}
		}
	}, nil
}

// readLoop is one blocking reader per store that fans every watched room's stream out, in order.
func (s *Redis) readLoop() {
	for {
		s.mu.Lock()
		if s.closed || len(s.watches) == 0 {
			s.readerOn = false
			s.mu.Unlock()
			return
		}
		rooms := make([]string, 0, len(s.watches))
		streams := make([]string, 0, 2*len(s.watches))
		for roomID := range s.watches {
			rooms = append(rooms, roomID)
		}
		ids := make([]string, len(rooms))
		for i, roomID := range rooms {
			streams = append(streams, s.Prefix(roomID)+":ops")
			ids[i] = s.watches[roomID].lastID
		}
		s.mu.Unlock()

		result, err := s.reader.XRead(context.Background(), &redis.XReadArgs{
			Streams: append(streams, ids...),
			Count:   1000,
			Block:   readBlock,
		}).Result()
		if err != nil && !errors.Is(err, redis.Nil) {
			s.reportError("reader", err)
			time.Sleep(100 * time.Millisecond)
			continue
		}
		for _, stream := range result {
			roomID := ""
			for i, key := range streams {
				if key == stream.Stream {
					roomID = rooms[i]
					break
				}
			}
			for _, message := range stream.Messages {
				s.mu.Lock()
				watch := s.watches[roomID]
				var listeners []func(RoomEvent)
				if watch != nil {
					watch.lastID = message.ID
					for _, l := range watch.listeners {
						listeners = append(listeners, l)
					}
				}
				s.mu.Unlock()
				event, ok := toEvent(message)
				if !ok {
					continue
				}
				for _, l := range listeners {
					l(event)
				}
			}
		}
	}
}

func (s *Redis) presenceChannel(roomID string) string { return s.Prefix(roomID) + ":presence" }

func (s *Redis) PublishPresence(ctx context.Context, roomID string, event PresenceEvent) error {
	return s.cmd.Publish(ctx, s.presenceChannel(roomID), event.Encode()).Err()
}

func (s *Redis) SubscribePresence(ctx context.Context, roomID string, listener func(PresenceEvent)) (Unsubscribe, error) {
	channel := s.presenceChannel(roomID)
	s.mu.Lock()
	listeners := s.presence[channel]
	first := listeners == nil
	if first {
		listeners = map[int]func(PresenceEvent){}
		s.presence[channel] = listeners
	}
	s.nextID++
	id := s.nextID
	listeners[id] = listener
	s.mu.Unlock()
	if first {
		if err := s.pubsub.Subscribe(ctx, channel); err != nil {
			return nil, err
		}
	}
	return func() {
		s.mu.Lock()
		current := s.presence[channel]
		empty := false
		if current != nil {
			delete(current, id)
			if len(current) == 0 {
				delete(s.presence, channel)
				empty = true
			}
		}
		s.mu.Unlock()
		if empty {
			_ = s.pubsub.Unsubscribe(context.Background(), channel)
		}
	}, nil
}

func (s *Redis) presenceLoop() {
	for message := range s.pubsub.Channel() {
		var event PresenceEvent
		if json.Unmarshal([]byte(message.Payload), &event) != nil {
			continue
		}
		s.mu.Lock()
		var listeners []func(PresenceEvent)
		for _, l := range s.presence[message.Channel] {
			listeners = append(listeners, l)
		}
		s.mu.Unlock()
		for _, l := range listeners {
			l(event)
		}
	}
}

var _ Shared = (*Redis)(nil)
