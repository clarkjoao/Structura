package serverless

import (
	"context"
	"encoding/json"
	"errors"
	"strconv"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
)

/*
DynamoRegistry shares the rooms table:

	c#<conn>   conn       data (record JSON), seq, ttl
	m#<room>   k#<conn>   data (member JSON), ttl
	m#<room>   cur        d:<conn> — what each socket was sent (the delivery cursor)
	m#<room>   lease      owner, exp
	m#<room>   host       since
	rooms      r#<room>   (the open-room index the reaper walks)
*/
type DynamoRegistry struct {
	db    *dynamodb.Client
	table string
	now   func() int64
}

// NewDynamoRegistry uses the rooms table.
func NewDynamoRegistry(db *dynamodb.Client, table string, now func() int64) *DynamoRegistry {
	return &DynamoRegistry{db: db, table: table, now: now}
}

func s(v string) types.AttributeValue { return &types.AttributeValueMemberS{Value: v} }
func n(v int64) types.AttributeValue {
	return &types.AttributeValueMemberN{Value: strconv.FormatInt(v, 10)}
}

func k(pk, sk string) map[string]types.AttributeValue {
	return map[string]types.AttributeValue{"pk": s(pk), "sk": s(sk)}
}

func str(item map[string]types.AttributeValue, name string) string {
	if v, ok := item[name].(*types.AttributeValueMemberS); ok {
		return v.Value
	}
	return ""
}

func num(item map[string]types.AttributeValue, name string) (int64, bool) {
	if v, ok := item[name].(*types.AttributeValueMemberN); ok {
		out, _ := strconv.ParseInt(v.Value, 10, 64)
		return out, true
	}
	return 0, false
}

func conditionFailed(err error) bool {
	var ccf *types.ConditionalCheckFailedException
	return errors.As(err, &ccf)
}

func (r *DynamoRegistry) ttl() types.AttributeValue {
	return n((r.now() + ConnTTL.Milliseconds()) / 1000)
}

func (r *DynamoRegistry) get(ctx context.Context, pk, sk string) (map[string]types.AttributeValue, error) {
	out, err := r.db.GetItem(ctx, &dynamodb.GetItemInput{TableName: aws.String(r.table), Key: k(pk, sk), ConsistentRead: aws.Bool(true)})
	if err != nil {
		return nil, err
	}
	return out.Item, nil
}

func (r *DynamoRegistry) GetConn(ctx context.Context, connID string) (*ConnRecord, error) {
	item, err := r.get(ctx, "c#"+connID, "conn")
	if err != nil || item == nil {
		return nil, err
	}
	var rec ConnRecord
	if err := json.Unmarshal([]byte(str(item, "data")), &rec); err != nil {
		return nil, err
	}
	rec.Seq = -1
	if seq, ok := num(item, "seq"); ok {
		rec.Seq = seq
	}
	return &rec, nil
}

func (r *DynamoRegistry) PutConn(ctx context.Context, rec ConnRecord) error {
	data, _ := json.Marshal(rec)
	// UpdateItem, not PutItem: the sequence number is written separately.
	_, err := r.db.UpdateItem(ctx, &dynamodb.UpdateItemInput{
		TableName:                 aws.String(r.table),
		Key:                       k("c#"+rec.ConnID, "conn"),
		UpdateExpression:          aws.String("SET #data = :d, #ttl = :t"),
		ExpressionAttributeNames:  map[string]string{"#data": "data", "#ttl": "ttl"},
		ExpressionAttributeValues: map[string]types.AttributeValue{":d": s(string(data)), ":t": r.ttl()},
	})
	return err
}

func (r *DynamoRegistry) DeleteConn(ctx context.Context, connID string) error {
	_, err := r.db.DeleteItem(ctx, &dynamodb.DeleteItemInput{TableName: aws.String(r.table), Key: k("c#"+connID, "conn")})
	return err
}

func (r *DynamoRegistry) AdvanceSeq(ctx context.Context, connID string, seq int64) error {
	_, err := r.db.UpdateItem(ctx, &dynamodb.UpdateItemInput{
		TableName:                 aws.String(r.table),
		Key:                       k("c#"+connID, "conn"),
		UpdateExpression:          aws.String("SET seq = :s"),
		ConditionExpression:       aws.String("attribute_exists(pk) AND (attribute_not_exists(seq) OR seq < :s)"),
		ExpressionAttributeValues: map[string]types.AttributeValue{":s": n(seq)},
	})
	if conditionFailed(err) {
		return nil
	}
	return err
}

func (r *DynamoRegistry) PutMember(ctx context.Context, roomID string, m Member) error {
	data, _ := json.Marshal(m)
	_, err := r.db.PutItem(ctx, &dynamodb.PutItemInput{
		TableName: aws.String(r.table),
		Item: map[string]types.AttributeValue{
			"pk": s("m#" + roomID), "sk": s("k#" + m.ConnID), "data": s(string(data)), "ttl": r.ttl(),
		},
	})
	return err
}

// SetDelivered writes the room's delivery cursor: one item, one attribute `d:<conn>` per socket.
func (r *DynamoRegistry) SetDelivered(ctx context.Context, roomID string, delivered map[string]int64) error {
	if len(delivered) == 0 {
		return nil
	}
	names := map[string]string{"#ttl": "ttl"}
	values := map[string]types.AttributeValue{":ttl": r.ttl()}
	sets := []string{"#ttl = :ttl"}
	i := 0
	for connID, version := range delivered {
		name, value := "#d"+strconv.Itoa(i), ":d"+strconv.Itoa(i)
		names[name], values[value] = "d:"+connID, n(version)
		sets = append(sets, name+" = "+value)
		i++
	}
	_, err := r.db.UpdateItem(ctx, &dynamodb.UpdateItemInput{
		TableName:                 aws.String(r.table),
		Key:                       k("m#"+roomID, "cur"),
		UpdateExpression:          aws.String("SET " + strings.Join(sets, ", ")),
		ExpressionAttributeNames:  names,
		ExpressionAttributeValues: values,
	})
	return err
}

func (r *DynamoRegistry) DeleteMember(ctx context.Context, roomID, connID string) error {
	if _, err := r.db.DeleteItem(ctx, &dynamodb.DeleteItemInput{TableName: aws.String(r.table), Key: k("m#"+roomID, "k#"+connID)}); err != nil {
		return err
	}
	_, err := r.db.UpdateItem(ctx, &dynamodb.UpdateItemInput{
		TableName:                aws.String(r.table),
		Key:                      k("m#"+roomID, "cur"),
		UpdateExpression:         aws.String("REMOVE #d"),
		ConditionExpression:      aws.String("attribute_exists(pk)"),
		ExpressionAttributeNames: map[string]string{"#d": "d:" + connID},
	})
	if conditionFailed(err) {
		return nil
	}
	return err
}

// ListMembers reads the room's partition in one query: the members and the delivery cursor.
func (r *DynamoRegistry) ListMembers(ctx context.Context, roomID string) ([]Member, error) {
	paginator := dynamodb.NewQueryPaginator(r.db, &dynamodb.QueryInput{
		TableName:                 aws.String(r.table),
		KeyConditionExpression:    aws.String("pk = :pk"),
		ExpressionAttributeValues: map[string]types.AttributeValue{":pk": s("m#" + roomID)},
		ConsistentRead:            aws.Bool(true),
	})
	var out []Member
	cursor := map[string]int64{}
	nowSec := r.now() / 1000
	for paginator.HasMorePages() {
		page, err := paginator.NextPage(ctx)
		if err != nil {
			return nil, err
		}
		for _, item := range page.Items {
			sk := str(item, "sk")
			if sk == "cur" {
				for name := range item {
					if strings.HasPrefix(name, "d:") {
						cursor[name[2:]], _ = num(item, name)
					}
				}
				continue
			}
			if !strings.HasPrefix(sk, "k#") {
				continue
			}
			if ttl, ok := num(item, "ttl"); ok && ttl < nowSec {
				continue
			}
			var m Member
			if json.Unmarshal([]byte(str(item, "data")), &m) != nil {
				continue
			}
			out = append(out, m)
		}
	}
	for i := range out {
		out[i].Delivered = cursor[out[i].ConnID]
	}
	return out, nil
}

func (r *DynamoRegistry) AcquireLease(ctx context.Context, roomID, owner string, ttl time.Duration) (bool, error) {
	now := r.now()
	_, err := r.db.PutItem(ctx, &dynamodb.PutItemInput{
		TableName:                 aws.String(r.table),
		Item:                      map[string]types.AttributeValue{"pk": s("m#" + roomID), "sk": s("lease"), "owner": s(owner), "exp": n(now + ttl.Milliseconds())},
		ConditionExpression:       aws.String("attribute_not_exists(pk) OR exp < :now OR #owner = :o"),
		ExpressionAttributeNames:  map[string]string{"#owner": "owner"},
		ExpressionAttributeValues: map[string]types.AttributeValue{":now": n(now), ":o": s(owner)},
	})
	if conditionFailed(err) {
		return false, nil
	}
	return err == nil, err
}

func (r *DynamoRegistry) ReleaseLease(ctx context.Context, roomID, owner string) error {
	_, err := r.db.DeleteItem(ctx, &dynamodb.DeleteItemInput{
		TableName:                 aws.String(r.table),
		Key:                       k("m#"+roomID, "lease"),
		ConditionExpression:       aws.String("#owner = :o"),
		ExpressionAttributeNames:  map[string]string{"#owner": "owner"},
		ExpressionAttributeValues: map[string]types.AttributeValue{":o": s(owner)},
	})
	if conditionFailed(err) {
		return nil
	}
	return err
}

func (r *DynamoRegistry) SetHostOffline(ctx context.Context, roomID string, since int64) error {
	_, err := r.db.PutItem(ctx, &dynamodb.PutItemInput{
		TableName: aws.String(r.table),
		Item:      map[string]types.AttributeValue{"pk": s("m#" + roomID), "sk": s("host"), "since": n(since), "ttl": r.ttl()},
	})
	return err
}

func (r *DynamoRegistry) ClearHostOffline(ctx context.Context, roomID string) error {
	_, err := r.db.DeleteItem(ctx, &dynamodb.DeleteItemInput{TableName: aws.String(r.table), Key: k("m#"+roomID, "host")})
	return err
}

func (r *DynamoRegistry) HostOfflineSince(ctx context.Context, roomID string) (int64, error) {
	item, err := r.get(ctx, "m#"+roomID, "host")
	if err != nil || item == nil {
		return 0, err
	}
	since, _ := num(item, "since")
	return since, nil
}

func (r *DynamoRegistry) AddRoom(ctx context.Context, roomID string) error {
	_, err := r.db.PutItem(ctx, &dynamodb.PutItemInput{
		TableName: aws.String(r.table),
		Item:      map[string]types.AttributeValue{"pk": s("rooms"), "sk": s("r#" + roomID), "ttl": r.ttl()},
	})
	return err
}

func (r *DynamoRegistry) RemoveRoom(ctx context.Context, roomID string) error {
	_, err := r.db.DeleteItem(ctx, &dynamodb.DeleteItemInput{TableName: aws.String(r.table), Key: k("rooms", "r#"+roomID)})
	if err != nil {
		return err
	}
	// Whatever membership is left is stale once the room is gone.
	members, err := r.ListMembers(ctx, roomID)
	if err != nil {
		return err
	}
	for _, m := range members {
		_, _ = r.db.DeleteItem(ctx, &dynamodb.DeleteItemInput{TableName: aws.String(r.table), Key: k("m#"+roomID, "k#"+m.ConnID)})
	}
	_, _ = r.db.DeleteItem(ctx, &dynamodb.DeleteItemInput{TableName: aws.String(r.table), Key: k("m#"+roomID, "cur")})
	_ = r.ClearHostOffline(ctx, roomID)
	return nil
}

func (r *DynamoRegistry) ListRooms(ctx context.Context) ([]string, error) {
	paginator := dynamodb.NewQueryPaginator(r.db, &dynamodb.QueryInput{
		TableName:                 aws.String(r.table),
		KeyConditionExpression:    aws.String("pk = :pk"),
		ExpressionAttributeValues: map[string]types.AttributeValue{":pk": s("rooms")},
	})
	var out []string
	for paginator.HasMorePages() {
		page, err := paginator.NextPage(ctx)
		if err != nil {
			return nil, err
		}
		for _, item := range page.Items {
			out = append(out, strings.TrimPrefix(str(item, "sk"), "r#"))
		}
	}
	return out, nil
}

var _ Registry = (*DynamoRegistry)(nil)
