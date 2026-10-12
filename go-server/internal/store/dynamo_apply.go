package store

import (
	"context"
	"encoding/json"
	"fmt"
	"math/rand/v2"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"

	"github.com/clarkjoao/structura/go-server/internal/merge"
	"github.com/clarkjoao/structura/go-server/internal/protocol"
)

/*
Applying patches on DynamoDB. Every commit is serialised on the room's meta item, so a room
takes one commit per round trip or so. To keep up with a room full of people dragging, patches
can go through a queue instead: each invocation enqueues its patch and one of them (the holder
of the room's write lease, see the serverless package) applies a whole batch per commit — up to
maxBatch patches merged in order, one transaction for all their entries and queue deletions, and
one write per touched item.
*/

// maxBatch keeps a batch transaction within DynamoDB's 100 actions: the meta update, one entry
// and one queue deletion per patch.
const maxBatch = 45

// contendedAttempts is how many times a commit retries before the room counts as too contended.
var contendedAttempts = 200

// QueuedPatch is a patch waiting in a room's queue, with who to answer.
type QueuedPatch struct {
	ConnID string `json:"connId"`
	ApplyInput
	key string
}

// QueuedResult is the outcome of a queued patch.
type QueuedResult struct {
	QueuedPatch
	ApplyResult
}

type queuedWire struct {
	ConnID        string          `json:"connId"`
	SenderID      string          `json:"senderId"`
	OpID          string          `json:"opId"`
	SenderVersion int64           `json:"senderVersion"`
	Patch         json.RawMessage `json:"patch"`
}

func queueSK(seq int64) string { return "q#" + protocol.FormatVersion(seq) }

// Enqueue adds a patch to the room's queue, in arrival order.
func (s *Dynamo) Enqueue(ctx context.Context, roomID string, p QueuedPatch) error {
	epoch, err := s.epoch(ctx, roomID)
	if err != nil {
		return err
	}
	if epoch == "" {
		return nil
	}
	pk := statePK(roomID, epoch)
	out, err := s.db.UpdateItem(ctx, &dynamodb.UpdateItemInput{
		TableName:                 aws.String(s.table),
		Key:                       key(pk, "qseq"),
		UpdateExpression:          aws.String("ADD n :one"),
		ExpressionAttributeValues: map[string]types.AttributeValue{":one": avN(1)},
		ReturnValues:              types.ReturnValueUpdatedNew,
	})
	if err != nil {
		return err
	}
	seq := getN(out.Attributes, "n")
	data := protocol.MustMarshal(queuedWire{
		ConnID: p.ConnID, SenderID: p.SenderID, OpID: p.OpID, SenderVersion: p.SenderVersion,
		Patch: protocol.MustMarshal(p.Patch),
	})
	_, err = s.db.PutItem(ctx, &dynamodb.PutItemInput{
		TableName: aws.String(s.table),
		Item:      map[string]types.AttributeValue{"pk": avS(pk), "sk": avS(queueSK(seq)), "data": avS(string(data))},
	})
	return err
}

// QueuePending reports whether the room has queued patches.
func (s *Dynamo) QueuePending(ctx context.Context, roomID string) (bool, error) {
	epoch, err := s.epoch(ctx, roomID)
	if err != nil || epoch == "" {
		return false, err
	}
	out, err := s.db.Query(ctx, &dynamodb.QueryInput{
		TableName:                 aws.String(s.table),
		KeyConditionExpression:    aws.String("pk = :pk AND begins_with(sk, :q)"),
		ExpressionAttributeValues: map[string]types.AttributeValue{":pk": avS(statePK(roomID, epoch)), ":q": avS("q#")},
		ConsistentRead:            aws.Bool(true),
		Limit:                     aws.Int32(1),
	})
	if err != nil {
		return false, err
	}
	return len(out.Items) > 0, nil
}

// ApplyQueued applies the oldest queued patches of a room, in order, in one commit, and removes
// them from the queue in the same transaction.
func (s *Dynamo) ApplyQueued(ctx context.Context, roomID string) ([]QueuedResult, error) {
	for attempt := 0; ; attempt++ {
		if err := backoff(ctx, attempt); err != nil {
			return nil, err
		}
		meta, err := s.readMeta(ctx, roomID)
		if err != nil {
			return nil, err
		}
		if meta == nil {
			return nil, nil
		}
		pk := statePK(roomID, meta.Epoch)
		out, err := s.db.Query(ctx, &dynamodb.QueryInput{
			TableName:                 aws.String(s.table),
			KeyConditionExpression:    aws.String("pk = :pk AND begins_with(sk, :q)"),
			ExpressionAttributeValues: map[string]types.AttributeValue{":pk": avS(pk), ":q": avS("q#")},
			ConsistentRead:            aws.Bool(true),
			Limit:                     aws.Int32(maxBatch),
		})
		if err != nil {
			return nil, err
		}
		if len(out.Items) == 0 {
			return nil, nil
		}
		queued := make([]QueuedPatch, 0, len(out.Items))
		for _, item := range out.Items {
			var w queuedWire
			_ = json.Unmarshal([]byte(getS(item, "data")), &w)
			patch, _ := protocol.ParsePatch(w.Patch)
			queued = append(queued, QueuedPatch{
				ConnID:     w.ConnID,
				ApplyInput: ApplyInput{Patch: patch, SenderVersion: w.SenderVersion, SenderID: w.SenderID, OpID: w.OpID},
				key:        getS(item, "sk"),
			})
		}
		if meta.Status != StatusOpen {
			// Nothing can apply; answer and clear them.
			results := make([]QueuedResult, len(queued))
			var deletes []types.WriteRequest
			for i, q := range queued {
				results[i] = QueuedResult{QueuedPatch: q, ApplyResult: ApplyResult{Status: NotOpen}}
				deletes = append(deletes, types.WriteRequest{DeleteRequest: &types.DeleteRequest{Key: key(pk, q.key)}})
			}
			return results, s.batchWrite(ctx, deletes)
		}
		results, retry, err := s.commit(ctx, meta, queued, true)
		if err != nil {
			return nil, err
		}
		if !retry {
			return results, nil
		}
	}
}

// ApplyPatch applies one patch directly (not through the queue).
func (s *Dynamo) ApplyPatch(ctx context.Context, roomID string, in ApplyInput) (ApplyResult, error) {
	for attempt := 0; ; attempt++ {
		if err := backoff(ctx, attempt); err != nil {
			return ApplyResult{}, err
		}
		meta, err := s.readMeta(ctx, roomID)
		if err != nil {
			return ApplyResult{}, err
		}
		if meta == nil || meta.Status != StatusOpen {
			return ApplyResult{Status: NotOpen}, nil
		}
		results, retry, err := s.commit(ctx, meta, []QueuedPatch{{ApplyInput: in}}, false)
		if err != nil {
			return ApplyResult{}, err
		}
		if !retry {
			return results[0].ApplyResult, nil
		}
	}
}

// backoff waits before a retry, with jitter, and gives up after a while: a room this contended
// refuses the edit rather than queueing it for ever.
func backoff(ctx context.Context, attempt int) error {
	if attempt == 0 {
		return nil
	}
	if attempt > contendedAttempts {
		return fmt.Errorf("dynamo: room too contended: %w", ErrUnavailable)
	}
	wait := time.Duration(rand.IntN(5+min(attempt, 20)*3)+1) * time.Millisecond
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-time.After(wait):
		return nil
	}
}

// commit merges patches in order onto the room as of meta and writes them in one transaction.
// retry is true when the room moved on meanwhile (or entries are still being materialised).
func (s *Dynamo) commit(ctx context.Context, meta *dynamoMeta, patches []QueuedPatch, fromQueue bool) ([]QueuedResult, bool, error) {
	if meta.applied < meta.Version {
		return nil, true, s.catchUp(ctx, meta)
	}
	roomID := meta.RoomID
	pk := statePK(roomID, meta.Epoch)

	// Read exactly what the merge looks at: the doc, the touched entities (and their
	// tombstones), and the locks guarding them.
	var keys []map[string]types.AttributeValue
	seen := map[string]bool{}
	add := func(sk string) {
		if !seen[sk] {
			seen[sk] = true
			keys = append(keys, key(pk, sk))
		}
	}
	for _, p := range patches {
		if len(p.Patch.Doc) > 0 {
			add("doc")
		}
		for _, collection := range protocol.Collections {
			for id := range p.Patch.Entities[collection] {
				add(entitySK(collection, id))
				if len(protocol.LockGuardedFields[collection]) > 0 {
					add(lockSK(id))
				}
			}
		}
	}
	items, err := s.batchGet(ctx, keys)
	if err != nil {
		return nil, false, err
	}
	target := merge.Target{State: protocol.EmptyState(), Tombstones: map[string]int64{}}
	if doc, ok := items["doc"]; ok {
		target.State.Doc = toStateItem(doc).fields
	}
	for sk, raw := range items {
		collection, id, ok := splitEntitySK(sk)
		if !ok {
			continue
		}
		item := toStateItem(raw)
		if item.deleted {
			target.Tombstones[merge.TombstoneKey(collection, id)] = item.v
		} else {
			target.State.Entities[collection][id] = item.fields
		}
	}

	now := s.now()
	lockHolder := func(entityID string) string {
		lock, ok := items[lockSK(entityID)]
		if ok && getN(lock, "exp") > now {
			return getS(lock, "holder")
		}
		return ""
	}
	version := meta.Version
	results := make([]QueuedResult, len(patches))
	var entries []protocol.Entry
	// The version that last touched each item, for the one write per item below.
	touched := map[string]int64{}
	// Where each entity created by this batch goes in its collection.
	created := map[string]int64{}
	for i, p := range patches {
		existed := map[string]bool{}
		for _, collection := range protocol.Collections {
			for id := range p.Patch.Entities[collection] {
				_, existed[entitySK(collection, id)] = target.State.Entities[collection][id]
			}
		}
		effective := merge.Apply(&target, p.Patch, version+1, merge.Context{
			SenderVersion: p.SenderVersion, SenderID: p.SenderID, LockHolder: lockHolder,
		})
		if effective.IsEmpty() {
			results[i] = QueuedResult{QueuedPatch: p, ApplyResult: ApplyResult{Status: Noop, Version: version}}
			continue
		}
		version++
		entries = append(entries, protocol.Entry{Version: version, OpID: p.OpID, Sender: p.SenderID, Patch: effective})
		results[i] = QueuedResult{QueuedPatch: p, ApplyResult: ApplyResult{Status: Applied, Version: version, Effective: effective}}
		if len(effective.Doc) > 0 {
			touched["doc"] = version
		}
		for _, collection := range protocol.Collections {
			for index, id := range effective.IDs(collection) {
				sk := entitySK(collection, id)
				touched[sk] = version
				if change := effective.Entities[collection][id]; !change.Delete && !existed[sk] {
					created[sk] = createdOrder(version, index)
				}
			}
		}
	}

	var actions []types.TransactWriteItem
	if len(entries) > 0 {
		actions = append(actions, types.TransactWriteItem{Update: &types.Update{
			TableName:                 aws.String(s.table),
			Key:                       key(metaPK(roomID), "meta"),
			UpdateExpression:          aws.String("SET version = :next"),
			ConditionExpression:       aws.String("version = :v AND applied = :v AND #status = :open AND epoch = :epoch"),
			ExpressionAttributeNames:  map[string]string{"#status": "status"},
			ExpressionAttributeValues: map[string]types.AttributeValue{":next": avN(version), ":v": avN(meta.Version), ":open": avS(StatusOpen), ":epoch": avS(meta.Epoch)},
		}})
	} else {
		// Nothing changes, but only if nobody committed meanwhile.
		actions = append(actions, types.TransactWriteItem{ConditionCheck: &types.ConditionCheck{
			TableName:                 aws.String(s.table),
			Key:                       key(metaPK(roomID), "meta"),
			ConditionExpression:       aws.String("version = :v AND epoch = :epoch"),
			ExpressionAttributeValues: map[string]types.AttributeValue{":v": avN(meta.Version), ":epoch": avS(meta.Epoch)},
		}})
	}
	ttl := avN((now + s.entryTTL.Milliseconds()) / 1000)
	for _, e := range entries {
		actions = append(actions, types.TransactWriteItem{Put: &types.Put{
			TableName: aws.String(s.table),
			Item: map[string]types.AttributeValue{
				"pk": avS(pk), "sk": avS(entrySK(e.Version)), "opId": avS(e.OpID), "sender": avS(e.Sender),
				"patch": avS(string(protocol.MustMarshal(e.Patch))), "ttl": ttl,
			},
			ConditionExpression: aws.String("attribute_not_exists(sk)"),
		}})
	}
	if fromQueue {
		for _, p := range patches {
			actions = append(actions, types.TransactWriteItem{Delete: &types.Delete{
				TableName:           aws.String(s.table),
				Key:                 key(pk, p.key),
				ConditionExpression: aws.String("attribute_exists(sk)"),
			}})
		}
	}
	if len(entries) == 0 && !fromQueue {
		return results, false, nil
	}
	if _, err := s.db.TransactWriteItems(ctx, &dynamodb.TransactWriteItemsInput{TransactItems: actions}); err != nil {
		if isTransactionCanceled(err) {
			return nil, true, nil
		}
		return nil, false, err
	}
	if len(entries) == 0 {
		return results, false, nil
	}

	// Committed. Write each touched item once, as it stands after the batch; the version that
	// last touched it guards against a slower writer.
	orders := map[string]int64{}
	for sk, raw := range items {
		if item := toStateItem(raw); !item.deleted && hasAttr(raw, "o") {
			orders[sk] = item.o
		}
	}
	for sk, o := range created {
		orders[sk] = o
	}
	if err := s.writeFinal(ctx, pk, &target, touched, orders); err == nil {
		_ = s.setApplied(ctx, roomID, version)
	}
	// On failure the next reader materialises the entries; nothing is lost.
	return results, false, nil
}

func splitEntitySK(sk string) (string, string, bool) {
	if len(sk) < 3 || sk[:2] != "e#" {
		return "", "", false
	}
	rest := sk[2:]
	for i := 0; i < len(rest); i++ {
		if rest[i] == '#' {
			return rest[:i], rest[i+1:], protocol.IsCollection(rest[:i])
		}
	}
	return "", "", false
}

// writeFinal writes each touched item as it stands after the batch. orders holds the creation
// order of the entities that existed before it.
func (s *Dynamo) writeFinal(ctx context.Context, pk string, target *merge.Target, touched, orders map[string]int64) error {
	type put struct {
		item map[string]types.AttributeValue
	}
	var puts []put
	for sk, version := range touched {
		item := map[string]types.AttributeValue{"pk": avS(pk), "sk": avS(sk), "v": avN(version)}
		if sk == "doc" {
			for f, v := range target.State.Doc {
				item[fieldPrefix+f] = avS(string(v))
			}
		} else {
			collection, id, _ := splitEntitySK(sk)
			entity, exists := target.State.Entities[collection][id]
			if !exists {
				item["del"] = avB(true)
			} else if o, known := orders[sk]; known {
				item["o"] = avN(o)
			}
			for f, v := range entity {
				item[fieldPrefix+f] = avS(string(v))
			}
		}
		puts = append(puts, put{item})
	}
	var firstErr error
	errs := make(chan error, len(puts))
	sem := make(chan struct{}, 16)
	for _, p := range puts {
		sem <- struct{}{}
		go func(p put) {
			defer func() { <-sem }()
			version := p.item["v"]
			_, err := s.db.PutItem(ctx, &dynamodb.PutItemInput{
				TableName:                 aws.String(s.table),
				Item:                      p.item,
				ConditionExpression:       aws.String("attribute_not_exists(v) OR v < :ver"),
				ExpressionAttributeValues: map[string]types.AttributeValue{":ver": version},
			})
			if isConditionFailed(err) {
				err = nil
			}
			errs <- err
		}(p)
	}
	for range puts {
		if err := <-errs; err != nil && firstErr == nil {
			firstErr = err
		}
	}
	return firstErr
}
