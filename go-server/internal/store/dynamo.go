package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"

	"github.com/clarkjoao/structura/go-server/internal/protocol"
)

/*
Dynamo keeps rooms in one DynamoDB table (string keys `pk`, `sk`; TTL attribute `ttl`):

	r#<room>                 meta        status, version, applied, epoch, host…, ttl once closed
	s#<room>#<epoch>         doc         v, f:<field>…
	s#<room>#<epoch>         e#<c>#<id>  v, f:<field>… — or v, del (a removal: the tombstone)
	s#<room>#<epoch>         v#<12 dig>  opId, sender, patch, ttl — an entry
	s#<room>#<epoch>         l#<entity>  holder, exp
	s#<room>#<epoch>         c#<6 dig>   seed chunk

State lives under the room's epoch, so a room recreated under the same id never sees the old one.

A patch commits as a write-ahead entry: one transaction moves `version` from V to V+1 (only while
`applied` = V) and puts entry V+1. The entry is then materialised onto the items, each write
conditioned on the item's own `v` being older, so a slow writer can never overwrite a newer
value; then `applied` advances. Whoever finds `applied` < `version` materialises the missing
entries first, in order. A crash between the two steps loses nothing.
*/

// dynamoRetryWait is the step of the linear backoff for what a batch call leaves unprocessed.
var dynamoRetryWait = 10 * time.Millisecond

// Dynamo is the serverless store.
type Dynamo struct {
	db       *dynamodb.Client
	table    string
	now      func() int64
	entryTTL time.Duration

	mu     sync.Mutex
	epochs map[string]epochCache
}

type epochCache struct {
	epoch string
	at    time.Time
}

// DynamoOptions configures a DynamoDB store.
type DynamoOptions struct {
	Now func() int64
	// EntryTTL is how long entries stay readable for resume (default 6 h).
	EntryTTL time.Duration
}

// NewDynamo uses an existing table (see EnsureTable).
func NewDynamo(db *dynamodb.Client, table string, opts DynamoOptions) *Dynamo {
	if opts.Now == nil {
		opts.Now = NowMs
	}
	if opts.EntryTTL == 0 {
		opts.EntryTTL = 6 * time.Hour
	}
	return &Dynamo{db: db, table: table, now: opts.Now, entryTTL: opts.EntryTTL, epochs: map[string]epochCache{}}
}

// EnsureTable creates the table when it does not exist (local runs and tests; production
// creates it from the deployment template).
func EnsureTable(ctx context.Context, db *dynamodb.Client, table string) error {
	_, err := db.CreateTable(ctx, &dynamodb.CreateTableInput{
		TableName:   aws.String(table),
		BillingMode: types.BillingModePayPerRequest,
		AttributeDefinitions: []types.AttributeDefinition{
			{AttributeName: aws.String("pk"), AttributeType: types.ScalarAttributeTypeS},
			{AttributeName: aws.String("sk"), AttributeType: types.ScalarAttributeTypeS},
		},
		KeySchema: []types.KeySchemaElement{
			{AttributeName: aws.String("pk"), KeyType: types.KeyTypeHash},
			{AttributeName: aws.String("sk"), KeyType: types.KeyTypeRange},
		},
	})
	var inUse *types.ResourceInUseException
	if err != nil && !errors.As(err, &inUse) {
		return err
	}
	waiter := dynamodb.NewTableExistsWaiter(db)
	if err := waiter.Wait(ctx, &dynamodb.DescribeTableInput{TableName: aws.String(table)}, 30*time.Second); err != nil {
		return err
	}
	_, _ = db.UpdateTimeToLive(ctx, &dynamodb.UpdateTimeToLiveInput{
		TableName:               aws.String(table),
		TimeToLiveSpecification: &types.TimeToLiveSpecification{AttributeName: aws.String("ttl"), Enabled: aws.Bool(true)},
	})
	return nil
}

func (s *Dynamo) Kind() string    { return "dynamodb" }
func (s *Dynamo) Available() bool { return true }
func (s *Dynamo) Close() error    { return nil }

// DB exposes the client (the serverless registry shares it).
func (s *Dynamo) DB() *dynamodb.Client { return s.db }

// Table is the table name.
func (s *Dynamo) Table() string { return s.table }

// ── Attribute helpers ───────────────────────────────────────────────────────

func avS(v string) types.AttributeValue { return &types.AttributeValueMemberS{Value: v} }
func avN(v int64) types.AttributeValue {
	return &types.AttributeValueMemberN{Value: strconv.FormatInt(v, 10)}
}
func avB(v bool) types.AttributeValue { return &types.AttributeValueMemberBOOL{Value: v} }
func key(pk, sk string) map[string]types.AttributeValue {
	return map[string]types.AttributeValue{"pk": avS(pk), "sk": avS(sk)}
}

func getS(item map[string]types.AttributeValue, name string) string {
	if v, ok := item[name].(*types.AttributeValueMemberS); ok {
		return v.Value
	}
	return ""
}

func getN(item map[string]types.AttributeValue, name string) int64 {
	if v, ok := item[name].(*types.AttributeValueMemberN); ok {
		n, _ := strconv.ParseInt(v.Value, 10, 64)
		return n
	}
	return 0
}

func hasAttr(item map[string]types.AttributeValue, name string) bool {
	_, ok := item[name]
	return ok
}

func getB(item map[string]types.AttributeValue, name string) bool {
	if v, ok := item[name].(*types.AttributeValueMemberBOOL); ok {
		return v.Value
	}
	return false
}

func isConditionFailed(err error) bool {
	var ccf *types.ConditionalCheckFailedException
	return errors.As(err, &ccf)
}

func isTransactionCanceled(err error) bool {
	var tce *types.TransactionCanceledException
	return errors.As(err, &tce)
}

const fieldPrefix = "f:"

func metaPK(roomID string) string           { return "r#" + roomID }
func statePK(roomID, epoch string) string   { return "s#" + roomID + "#" + epoch }
func entitySK(collection, id string) string { return "e#" + collection + "#" + id }
func entrySK(version int64) string          { return "v#" + protocol.FormatVersion(version) }
func lockSK(entityID string) string         { return "l#" + entityID }
func seedSK(index int) string               { return fmt.Sprintf("c#%06d", index) }

// ── Meta ────────────────────────────────────────────────────────────────────

type dynamoMeta struct {
	Meta
	applied    int64
	hostOnline bool
}

func (s *Dynamo) readMeta(ctx context.Context, roomID string) (*dynamoMeta, error) {
	out, err := s.db.GetItem(ctx, &dynamodb.GetItemInput{
		TableName:      aws.String(s.table),
		Key:            key(metaPK(roomID), "meta"),
		ConsistentRead: aws.Bool(true),
	})
	if err != nil {
		return nil, err
	}
	item := out.Item
	if item == nil {
		return nil, nil
	}
	// DynamoDB deletes expired items lazily; an expired room is gone.
	if hasAttr(item, "ttl") && getN(item, "ttl")*1000 < s.now() {
		return nil, nil
	}
	var user protocol.User
	_ = json.Unmarshal([]byte(getS(item, "hostUser")), &user)
	m := &dynamoMeta{
		Meta: Meta{
			RoomID:        roomID,
			Status:        getS(item, "status"),
			Version:       getN(item, "version"),
			HostTokenHash: getS(item, "hostTokenHash"),
			HostUser:      user,
			SeedChunks:    int(getN(item, "seedChunks")),
			CreatedAt:     getN(item, "createdAt"),
			Epoch:         getS(item, "epoch"),
		},
		applied:    getN(item, "applied"),
		hostOnline: getB(item, "hostOnline"),
	}
	s.mu.Lock()
	s.epochs[roomID] = epochCache{epoch: m.Epoch, at: time.Now()}
	s.mu.Unlock()
	return m, nil
}

// epoch returns the room's current epoch, cached briefly: lock calls come in batches of hundreds.
func (s *Dynamo) epoch(ctx context.Context, roomID string) (string, error) {
	s.mu.Lock()
	cached, ok := s.epochs[roomID]
	s.mu.Unlock()
	if ok && time.Since(cached.at) < 2*time.Second {
		return cached.epoch, nil
	}
	meta, err := s.readMeta(ctx, roomID)
	if err != nil || meta == nil {
		return "", err
	}
	return meta.Epoch, nil
}

func (s *Dynamo) GetMeta(ctx context.Context, roomID string) (*Meta, error) {
	meta, err := s.readMeta(ctx, roomID)
	if err != nil || meta == nil {
		return nil, err
	}
	out := meta.Meta
	return &out, nil
}

func (s *Dynamo) CreateRoom(ctx context.Context, in CreateInput) (bool, error) {
	_, err := s.db.PutItem(ctx, &dynamodb.PutItemInput{
		TableName: aws.String(s.table),
		Item: map[string]types.AttributeValue{
			"pk":            avS(metaPK(in.RoomID)),
			"sk":            avS("meta"),
			"status":        avS(StatusSeeding),
			"version":       avN(0),
			"applied":       avN(0),
			"epoch":         avS(NewEpoch()),
			"hostTokenHash": avS(in.HostTokenHash),
			"hostUser":      avS(string(protocol.MustMarshal(in.HostUser))),
			"seedChunks":    avN(int64(in.SeedChunks)),
			"createdAt":     avN(in.Now),
			"hostOnline":    avB(true),
		},
		ConditionExpression:       aws.String("attribute_not_exists(pk) OR (attribute_exists(#ttl) AND #ttl < :now)"),
		ExpressionAttributeNames:  map[string]string{"#ttl": "ttl"},
		ExpressionAttributeValues: map[string]types.AttributeValue{":now": avN(s.now() / 1000)},
	})
	if isConditionFailed(err) {
		return false, nil
	}
	if err == nil {
		s.mu.Lock()
		delete(s.epochs, in.RoomID)
		s.mu.Unlock()
	}
	return err == nil, err
}

func (s *Dynamo) AppendSeedChunk(ctx context.Context, roomID string, index int, literal string) error {
	meta, err := s.readMeta(ctx, roomID)
	if err != nil || meta == nil || meta.Status != StatusSeeding {
		return err
	}
	_, err = s.db.PutItem(ctx, &dynamodb.PutItemInput{
		TableName: aws.String(s.table),
		Item: map[string]types.AttributeValue{
			"pk":   avS(statePK(roomID, meta.Epoch)),
			"sk":   avS(seedSK(index)),
			"data": avS(literal),
		},
	})
	return err
}

// queryPrefix reads every item of a partition whose sort key starts with prefix.
func (s *Dynamo) queryPrefix(ctx context.Context, pk, prefix string, keysOnly bool) ([]map[string]types.AttributeValue, error) {
	input := &dynamodb.QueryInput{
		TableName:                 aws.String(s.table),
		KeyConditionExpression:    aws.String("pk = :pk AND begins_with(sk, :p)"),
		ExpressionAttributeValues: map[string]types.AttributeValue{":pk": avS(pk), ":p": avS(prefix)},
		ConsistentRead:            aws.Bool(true),
	}
	if prefix == "" {
		input.KeyConditionExpression = aws.String("pk = :pk")
		input.ExpressionAttributeValues = map[string]types.AttributeValue{":pk": avS(pk)}
	}
	if keysOnly {
		input.ProjectionExpression = aws.String("pk, sk")
	}
	var out []map[string]types.AttributeValue
	paginator := dynamodb.NewQueryPaginator(s.db, input)
	for paginator.HasMorePages() {
		page, err := paginator.NextPage(ctx)
		if err != nil {
			return nil, err
		}
		out = append(out, page.Items...)
	}
	return out, nil
}

// batchWrite writes or deletes items 25 at a time, retrying what DynamoDB leaves unprocessed.
func (s *Dynamo) batchWrite(ctx context.Context, requests []types.WriteRequest) error {
	for start := 0; start < len(requests); start += 25 {
		pending := requests[start:min(start+25, len(requests))]
		for attempt := 0; len(pending) > 0; attempt++ {
			out, err := s.db.BatchWriteItem(ctx, &dynamodb.BatchWriteItemInput{
				RequestItems: map[string][]types.WriteRequest{s.table: pending},
			})
			if err != nil {
				return err
			}
			pending = out.UnprocessedItems[s.table]
			if len(pending) > 0 {
				if attempt > 20 {
					return ErrUnavailable
				}
				time.Sleep(time.Duration(attempt+1) * dynamoRetryWait)
			}
		}
	}
	return nil
}

func (s *Dynamo) CommitSeed(ctx context.Context, roomID string) (CommitResult, error) {
	meta, err := s.readMeta(ctx, roomID)
	if err != nil {
		return CommitResult{}, err
	}
	if meta == nil || meta.Status != StatusSeeding {
		return CommitResult{Code: "not_seeding"}, nil
	}
	pk := statePK(roomID, meta.Epoch)
	items, err := s.queryPrefix(ctx, pk, "c#", false)
	if err != nil {
		return CommitResult{}, err
	}
	chunks := map[string]string{}
	for _, item := range items {
		chunks[getS(item, "sk")] = getS(item, "data")
	}
	literals := make([]string, meta.SeedChunks)
	for i := range literals {
		part, ok := chunks[seedSK(i)]
		if !ok {
			return CommitResult{Code: "invalid_seed"}, nil
		}
		literals[i] = part
	}
	state, ok := ParseSeed(literals)
	if !ok {
		return CommitResult{Code: "invalid_seed"}, nil
	}

	var writes []types.WriteRequest
	doc := map[string]types.AttributeValue{"pk": avS(pk), "sk": avS("doc"), "v": avN(0)}
	for field, value := range state.Doc {
		doc[fieldPrefix+field] = avS(string(value))
	}
	writes = append(writes, types.WriteRequest{PutRequest: &types.PutRequest{Item: doc}})
	for _, collection := range protocol.Collections {
		for index, id := range state.IDs(collection) {
			entity := state.Entities[collection][id]
			item := map[string]types.AttributeValue{"pk": avS(pk), "sk": avS(entitySK(collection, id)), "v": avN(0), "o": avN(int64(index))}
			for field, value := range entity {
				item[fieldPrefix+field] = avS(string(value))
			}
			writes = append(writes, types.WriteRequest{PutRequest: &types.PutRequest{Item: item}})
		}
	}
	for _, item := range items {
		writes = append(writes, types.WriteRequest{DeleteRequest: &types.DeleteRequest{Key: key(pk, getS(item, "sk"))}})
	}
	if err := s.batchWrite(ctx, writes); err != nil {
		return CommitResult{}, err
	}
	_, err = s.db.UpdateItem(ctx, &dynamodb.UpdateItemInput{
		TableName:                 aws.String(s.table),
		Key:                       key(metaPK(roomID), "meta"),
		UpdateExpression:          aws.String("SET #status = :open, version = :zero, applied = :zero"),
		ConditionExpression:       aws.String("#status = :seeding AND epoch = :epoch"),
		ExpressionAttributeNames:  map[string]string{"#status": "status"},
		ExpressionAttributeValues: map[string]types.AttributeValue{":open": avS(StatusOpen), ":zero": avN(0), ":seeding": avS(StatusSeeding), ":epoch": avS(meta.Epoch)},
	})
	if isConditionFailed(err) {
		return CommitResult{Code: "not_seeding"}, nil
	}
	if err != nil {
		return CommitResult{}, err
	}
	return CommitResult{OK: true}, nil
}

func (s *Dynamo) deletePartition(ctx context.Context, pk string) error {
	items, err := s.queryPrefix(ctx, pk, "", true)
	if err != nil {
		return err
	}
	writes := make([]types.WriteRequest, 0, len(items))
	for _, item := range items {
		writes = append(writes, types.WriteRequest{DeleteRequest: &types.DeleteRequest{Key: key(pk, getS(item, "sk"))}})
	}
	return s.batchWrite(ctx, writes)
}

func (s *Dynamo) DiscardRoom(ctx context.Context, roomID string) error {
	meta, err := s.readMeta(ctx, roomID)
	if err != nil || meta == nil {
		return err
	}
	if _, err := s.db.DeleteItem(ctx, &dynamodb.DeleteItemInput{TableName: aws.String(s.table), Key: key(metaPK(roomID), "meta")}); err != nil {
		return err
	}
	s.mu.Lock()
	delete(s.epochs, roomID)
	s.mu.Unlock()
	return s.deletePartition(ctx, statePK(roomID, meta.Epoch))
}

// ── Items as state ──────────────────────────────────────────────────────────

type stateItem struct {
	v       int64
	o       int64
	deleted bool
	fields  map[string]json.RawMessage
}

// createdOrder is the `o` of the index-th entity created by the entry at version: after every
// seeded one, in version order, then in the order the entry lists them.
func createdOrder(version int64, index int) int64 {
	return 1<<40 + version<<12 + int64(min(index, 4095))
}

func toStateItem(item map[string]types.AttributeValue) stateItem {
	out := stateItem{v: getN(item, "v"), o: getN(item, "o"), deleted: getB(item, "del"), fields: map[string]json.RawMessage{}}
	for name, value := range item {
		if strings.HasPrefix(name, fieldPrefix) {
			if s, ok := value.(*types.AttributeValueMemberS); ok {
				out.fields[name[len(fieldPrefix):]] = json.RawMessage(s.Value)
			}
		}
	}
	return out
}

// applyToItem applies one entry's change for one item in memory, as materialise would.
func applyToItem(item *stateItem, version int64, index int, entityPatch *protocol.EntityPatch, docSet map[string]json.RawMessage) {
	if item.v >= version {
		return
	}
	item.v = version
	if docSet != nil {
		for f, v := range docSet {
			item.fields[f] = v
		}
		return
	}
	if entityPatch.Delete {
		item.deleted = true
		item.fields = map[string]json.RawMessage{}
		return
	}
	if item.deleted || item.o < 0 {
		item.o = createdOrder(version, index)
	}
	item.deleted = false
	for f, v := range entityPatch.Set {
		item.fields[f] = v
	}
	for _, f := range entityPatch.Unset {
		delete(item.fields, f)
	}
}

// ── Patches ─────────────────────────────────────────────────────────────────

// readEntryItems reads entries from+1..to; every caller has from < to.
func (s *Dynamo) readEntryItems(ctx context.Context, pk string, from, to int64) ([]protocol.Entry, error) {
	input := &dynamodb.QueryInput{
		TableName:                 aws.String(s.table),
		KeyConditionExpression:    aws.String("pk = :pk AND sk BETWEEN :a AND :b"),
		ExpressionAttributeValues: map[string]types.AttributeValue{":pk": avS(pk), ":a": avS(entrySK(from + 1)), ":b": avS(entrySK(to))},
		ConsistentRead:            aws.Bool(true),
	}
	var out []protocol.Entry
	paginator := dynamodb.NewQueryPaginator(s.db, input)
	for paginator.HasMorePages() {
		page, err := paginator.NextPage(ctx)
		if err != nil {
			return nil, err
		}
		for _, item := range page.Items {
			patch, ok := protocol.ParsePatch([]byte(getS(item, "patch")))
			if !ok {
				return nil, fmt.Errorf("dynamo: unreadable entry %s", getS(item, "sk"))
			}
			version, _ := strconv.ParseInt(strings.TrimPrefix(getS(item, "sk"), "v#"), 10, 64)
			out = append(out, protocol.Entry{Version: version, OpID: getS(item, "opId"), Sender: getS(item, "sender"), Patch: patch})
		}
	}
	return out, nil
}

// materialise writes one entry onto the items, each write conditioned on the item being older.
func (s *Dynamo) materialise(ctx context.Context, pk string, entry protocol.Entry) error {
	type write func() error
	var writes []write
	ver := avN(entry.Version)
	older := "attribute_not_exists(v) OR v < :ver"

	if len(entry.Patch.Doc) > 0 {
		names := map[string]string{}
		values := map[string]types.AttributeValue{":ver": ver}
		var sets []string
		i := 0
		for f, v := range entry.Patch.Doc {
			n, val := fmt.Sprintf("#f%d", i), fmt.Sprintf(":f%d", i)
			names[n], values[val] = fieldPrefix+f, avS(string(v))
			sets = append(sets, n+" = "+val)
			i++
		}
		expr := "SET " + strings.Join(append(sets, "v = :ver"), ", ")
		writes = append(writes, func() error {
			_, err := s.db.UpdateItem(ctx, &dynamodb.UpdateItemInput{
				TableName: aws.String(s.table), Key: key(pk, "doc"),
				UpdateExpression: aws.String(expr), ConditionExpression: aws.String(older),
				ExpressionAttributeNames: names, ExpressionAttributeValues: values,
			})
			return err
		})
	}
	for _, collection := range protocol.Collections {
		for index, id := range entry.Patch.IDs(collection) {
			entityPatch := entry.Patch.Entities[collection][id]
			sk := entitySK(collection, id)
			if entityPatch == nil || entityPatch.Delete {
				writes = append(writes, func() error {
					_, err := s.db.PutItem(ctx, &dynamodb.PutItemInput{
						TableName:                 aws.String(s.table),
						Item:                      map[string]types.AttributeValue{"pk": avS(pk), "sk": avS(sk), "v": ver, "del": avB(true)},
						ConditionExpression:       aws.String(older),
						ExpressionAttributeValues: map[string]types.AttributeValue{":ver": ver},
					})
					return err
				})
				continue
			}
			names := map[string]string{"#del": "del"}
			values := map[string]types.AttributeValue{":ver": ver, ":o": avN(createdOrder(entry.Version, index))}
			sets := []string{"v = :ver", "o = if_not_exists(o, :o)"}
			var removes []string
			i := 0
			for f, v := range entityPatch.Set {
				n, val := fmt.Sprintf("#s%d", i), fmt.Sprintf(":s%d", i)
				names[n], values[val] = fieldPrefix+f, avS(string(v))
				sets = append(sets, n+" = "+val)
				i++
			}
			removes = append(removes, "#del")
			for j, f := range entityPatch.Unset {
				n := fmt.Sprintf("#u%d", j)
				names[n] = fieldPrefix + f
				removes = append(removes, n)
			}
			expr := "SET " + strings.Join(sets, ", ") + " REMOVE " + strings.Join(removes, ", ")
			writes = append(writes, func() error {
				_, err := s.db.UpdateItem(ctx, &dynamodb.UpdateItemInput{
					TableName: aws.String(s.table), Key: key(pk, sk),
					UpdateExpression: aws.String(expr), ConditionExpression: aws.String(older),
					ExpressionAttributeNames: names, ExpressionAttributeValues: values,
				})
				return err
			})
		}
	}

	var wg sync.WaitGroup
	var mu sync.Mutex
	var first error
	sem := make(chan struct{}, 16)
	for _, w := range writes {
		wg.Add(1)
		sem <- struct{}{}
		go func(w write) {
			defer wg.Done()
			defer func() { <-sem }()
			if err := w(); err != nil && !isConditionFailed(err) {
				mu.Lock()
				if first == nil {
					first = err
				}
				mu.Unlock()
			}
		}(w)
	}
	wg.Wait()
	return first
}

func (s *Dynamo) setApplied(ctx context.Context, roomID string, version int64) error {
	_, err := s.db.UpdateItem(ctx, &dynamodb.UpdateItemInput{
		TableName:                 aws.String(s.table),
		Key:                       key(metaPK(roomID), "meta"),
		UpdateExpression:          aws.String("SET applied = :v"),
		ConditionExpression:       aws.String("applied < :v"),
		ExpressionAttributeValues: map[string]types.AttributeValue{":v": avN(version)},
	})
	if isConditionFailed(err) {
		return nil
	}
	return err
}

// catchUp materialises every committed entry not yet applied, in order.
func (s *Dynamo) catchUp(ctx context.Context, meta *dynamoMeta) error {
	if meta.applied >= meta.Version {
		return nil
	}
	pk := statePK(meta.RoomID, meta.Epoch)
	entries, err := s.readEntryItems(ctx, pk, meta.applied, meta.Version)
	if err != nil {
		return err
	}
	for _, entry := range entries {
		if err := s.materialise(ctx, pk, entry); err != nil {
			return err
		}
	}
	return s.setApplied(ctx, meta.RoomID, meta.Version)
}

func (s *Dynamo) batchGet(ctx context.Context, keys []map[string]types.AttributeValue) (map[string]map[string]types.AttributeValue, error) {
	out := map[string]map[string]types.AttributeValue{}
	for start := 0; start < len(keys); start += 100 {
		pending := map[string]types.KeysAndAttributes{s.table: {Keys: keys[start:min(start+100, len(keys))], ConsistentRead: aws.Bool(true)}}
		for attempt := 0; len(pending[s.table].Keys) > 0; attempt++ {
			result, err := s.db.BatchGetItem(ctx, &dynamodb.BatchGetItemInput{RequestItems: pending})
			if err != nil {
				return nil, err
			}
			for _, item := range result.Responses[s.table] {
				out[getS(item, "sk")] = item
			}
			pending = result.UnprocessedKeys
			if len(pending[s.table].Keys) > 0 {
				if attempt > 20 {
					return nil, ErrUnavailable
				}
				time.Sleep(time.Duration(attempt+1) * dynamoRetryWait)
			}
		}
	}
	return out, nil
}

func (s *Dynamo) ReadSnapshot(ctx context.Context, roomID string) (*Snapshot, error) {
	meta, err := s.readMeta(ctx, roomID)
	if err != nil || meta == nil || meta.Status != StatusOpen {
		return nil, err
	}
	if err := s.catchUp(ctx, meta); err != nil {
		return nil, err
	}
	// Everything up to here is on the items; whatever lands while we read them is replayed below.
	base := meta.Version
	pk := statePK(roomID, meta.Epoch)
	raw, err := s.queryPrefix(ctx, pk, "", false)
	if err != nil {
		return nil, err
	}
	after, err := s.readMeta(ctx, roomID)
	if err != nil {
		return nil, err
	}
	if after == nil || after.Status != StatusOpen || after.Epoch != meta.Epoch {
		return nil, nil
	}
	items := map[string]*stateItem{}
	for _, item := range raw {
		sk := getS(item, "sk")
		if sk == "doc" || strings.HasPrefix(sk, "e#") {
			it := toStateItem(item)
			items[sk] = &it
		}
	}
	if after.Version > base {
		entries, err := s.readEntryItems(ctx, pk, base, after.Version)
		if err != nil {
			return nil, err
		}
		for _, entry := range entries {
			if len(entry.Patch.Doc) > 0 {
				it := items["doc"]
				if it == nil {
					it = &stateItem{fields: map[string]json.RawMessage{}}
					items["doc"] = it
				}
				applyToItem(it, entry.Version, 0, nil, entry.Patch.Doc)
			}
			for _, collection := range protocol.Collections {
				for index, id := range entry.Patch.IDs(collection) {
					sk := entitySK(collection, id)
					it := items[sk]
					if it == nil {
						it = &stateItem{fields: map[string]json.RawMessage{}, o: -1}
						items[sk] = it
					}
					applyToItem(it, entry.Version, index, entry.Patch.Entities[collection][id], nil)
				}
			}
		}
	}
	state := protocol.EmptyState()
	// Creation order: what the seed held, then what was created after, in version order.
	sks := make([]string, 0, len(items))
	for sk := range items {
		sks = append(sks, sk)
	}
	sort.Slice(sks, func(a, b int) bool {
		if items[sks[a]].o != items[sks[b]].o {
			return items[sks[a]].o < items[sks[b]].o
		}
		return sks[a] < sks[b]
	})
	for _, sk := range sks {
		it := items[sk]
		if sk == "doc" {
			for f, v := range it.fields {
				if protocol.IsDocField(f) {
					state.Doc[f] = v
				}
			}
			continue
		}
		if it.deleted {
			continue
		}
		rest := strings.TrimPrefix(sk, "e#")
		sep := strings.IndexByte(rest, '#')
		if sep < 0 {
			continue
		}
		collection, id := rest[:sep], rest[sep+1:]
		if !protocol.IsCollection(collection) {
			continue
		}
		state.Entities[collection][id] = it.fields
		state.Created(collection, id)
	}
	return &Snapshot{Version: after.Version, State: state}, nil
}

func (s *Dynamo) ReadEntries(ctx context.Context, roomID string, from int64) ([]protocol.Entry, bool, error) {
	meta, err := s.readMeta(ctx, roomID)
	if err != nil {
		return nil, false, err
	}
	if meta == nil || meta.Status != StatusOpen || from > meta.Version {
		return nil, false, nil
	}
	if from == meta.Version {
		return []protocol.Entry{}, true, nil
	}
	entries, err := s.readEntryItems(ctx, statePK(roomID, meta.Epoch), from, meta.Version)
	if err != nil {
		return nil, false, err
	}
	sort.Slice(entries, func(i, j int) bool { return entries[i].Version < entries[j].Version })
	if int64(len(entries)) != meta.Version-from || entries[0].Version != from+1 {
		return nil, false, nil
	}
	return entries, true, nil
}

// ── Locks and host status ───────────────────────────────────────────────────

func (s *Dynamo) AcquireLock(ctx context.Context, roomID, entityID, clientID string, ttl time.Duration) (bool, string, error) {
	epoch, err := s.epoch(ctx, roomID)
	if err != nil || epoch == "" {
		return false, "", err
	}
	k := key(statePK(roomID, epoch), lockSK(entityID))
	for attempt := 0; attempt < 3; attempt++ {
		now := s.now()
		_, err = s.db.UpdateItem(ctx, &dynamodb.UpdateItemInput{
			TableName:                 aws.String(s.table),
			Key:                       k,
			UpdateExpression:          aws.String("SET holder = :c, exp = :e"),
			ConditionExpression:       aws.String("attribute_not_exists(holder) OR holder = :c OR exp <= :now"),
			ExpressionAttributeValues: map[string]types.AttributeValue{":c": avS(clientID), ":e": avN(now + ttl.Milliseconds()), ":now": avN(now)},
		})
		if err == nil {
			return true, clientID, nil
		}
		if !isConditionFailed(err) {
			return false, "", err
		}
		out, err := s.db.GetItem(ctx, &dynamodb.GetItemInput{TableName: aws.String(s.table), Key: k, ConsistentRead: aws.Bool(true)})
		if err != nil {
			return false, "", err
		}
		if out.Item != nil && getN(out.Item, "exp") > s.now() {
			return false, getS(out.Item, "holder"), nil
		}
	}
	return false, "", nil
}

func (s *Dynamo) ReleaseLock(ctx context.Context, roomID, entityID, clientID string) (bool, error) {
	epoch, err := s.epoch(ctx, roomID)
	if err != nil || epoch == "" {
		return false, err
	}
	_, err = s.db.DeleteItem(ctx, &dynamodb.DeleteItemInput{
		TableName:                 aws.String(s.table),
		Key:                       key(statePK(roomID, epoch), lockSK(entityID)),
		ConditionExpression:       aws.String("holder = :c"),
		ExpressionAttributeValues: map[string]types.AttributeValue{":c": avS(clientID)},
	})
	if isConditionFailed(err) {
		return false, nil
	}
	return err == nil, err
}

func (s *Dynamo) MarkHostOffline(ctx context.Context, roomID string) (bool, error) {
	_, err := s.db.UpdateItem(ctx, &dynamodb.UpdateItemInput{
		TableName:                 aws.String(s.table),
		Key:                       key(metaPK(roomID), "meta"),
		UpdateExpression:          aws.String("SET hostOnline = :f, hostOfflineAt = :now"),
		ConditionExpression:       aws.String("hostOnline = :t"),
		ExpressionAttributeValues: map[string]types.AttributeValue{":f": avB(false), ":t": avB(true), ":now": avN(s.now())},
	})
	if isConditionFailed(err) {
		return false, nil
	}
	return err == nil, err
}

func (s *Dynamo) MarkHostOnline(ctx context.Context, roomID string) error {
	_, err := s.db.UpdateItem(ctx, &dynamodb.UpdateItemInput{
		TableName:                 aws.String(s.table),
		Key:                       key(metaPK(roomID), "meta"),
		UpdateExpression:          aws.String("SET hostOnline = :t REMOVE hostOfflineAt"),
		ConditionExpression:       aws.String("attribute_exists(pk)"),
		ExpressionAttributeValues: map[string]types.AttributeValue{":t": avB(true)},
	})
	if isConditionFailed(err) {
		return nil
	}
	return err
}

func (s *Dynamo) IsHostOnline(ctx context.Context, roomID string) (bool, error) {
	meta, err := s.readMeta(ctx, roomID)
	if err != nil || meta == nil {
		return false, err
	}
	return meta.hostOnline, nil
}

// HostOfflineSince is when the host went offline, or 0 while it is online.
func (s *Dynamo) HostOfflineSince(ctx context.Context, roomID string) (int64, error) {
	out, err := s.db.GetItem(ctx, &dynamodb.GetItemInput{TableName: aws.String(s.table), Key: key(metaPK(roomID), "meta"), ConsistentRead: aws.Bool(true)})
	if err != nil || out.Item == nil || getB(out.Item, "hostOnline") {
		return 0, err
	}
	return getN(out.Item, "hostOfflineAt"), nil
}

func (s *Dynamo) CloseRoom(ctx context.Context, roomID, reason string) (bool, error) {
	meta, err := s.readMeta(ctx, roomID)
	if err != nil || meta == nil {
		return false, err
	}
	_, err = s.db.UpdateItem(ctx, &dynamodb.UpdateItemInput{
		TableName:                 aws.String(s.table),
		Key:                       key(metaPK(roomID), "meta"),
		UpdateExpression:          aws.String("SET #status = :closed, closeReason = :r, #ttl = :ttl"),
		ConditionExpression:       aws.String("attribute_exists(pk) AND #status <> :closed"),
		ExpressionAttributeNames:  map[string]string{"#status": "status", "#ttl": "ttl"},
		ExpressionAttributeValues: map[string]types.AttributeValue{":closed": avS(StatusClosed), ":r": avS(reason), ":ttl": avN((s.now() + ClosedRoomTTL.Milliseconds()) / 1000)},
	})
	if isConditionFailed(err) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	// The state goes with the session; a failure here only leaves unreachable items behind.
	_ = s.deletePartition(ctx, statePK(roomID, meta.Epoch))
	return true, nil
}

// CloseReason is why a closed room closed ("" when it is not closed).
func (s *Dynamo) CloseReason(ctx context.Context, roomID string) (string, error) {
	out, err := s.db.GetItem(ctx, &dynamodb.GetItemInput{TableName: aws.String(s.table), Key: key(metaPK(roomID), "meta"), ConsistentRead: aws.Bool(true)})
	if err != nil || out.Item == nil {
		return "", err
	}
	return getS(out.Item, "closeReason"), nil
}

var _ Rooms = (*Dynamo)(nil)
