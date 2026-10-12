package serverless

import (
	"context"
	"encoding/json"
	"errors"
	"strconv"
	"time"

	"github.com/redis/go-redis/v9"
)

/*
RedisRegistry keeps the serverless records next to the rooms, under the deployment namespace:

	sl:conn:<conn>             String  record JSON (TTL)
	sl:seq:<conn>              String  applied patch sequence (TTL)
	c:{<room>}:sl:members      Hash    conn → member JSON
	c:{<room>}:sl:cursor       Hash    conn → delivered version
	c:{<room>}:sl:lease        String  owner (PX)
	c:{<room>}:sl:host         String  since
	sl:rooms                   Set     open rooms
*/
type RedisRegistry struct {
	c         *redis.Client
	namespace string
}

// NewRedisRegistry uses the rooms' Redis.
func NewRedisRegistry(c *redis.Client, namespace string) *RedisRegistry {
	return &RedisRegistry{c: c, namespace: namespace}
}

func (r *RedisRegistry) connKey(id string) string { return r.namespace + "sl:conn:" + id }
func (r *RedisRegistry) seqKey(id string) string  { return r.namespace + "sl:seq:" + id }
func (r *RedisRegistry) room(roomID, suffix string) string {
	return r.namespace + "c:{" + roomID + "}:sl:" + suffix
}
func (r *RedisRegistry) roomsKey() string { return r.namespace + "sl:rooms" }

func (r *RedisRegistry) GetConn(ctx context.Context, connID string) (*ConnRecord, error) {
	values, err := r.c.MGet(ctx, r.connKey(connID), r.seqKey(connID)).Result()
	if err != nil {
		return nil, err
	}
	raw, ok := values[0].(string)
	if !ok {
		return nil, nil
	}
	var rec ConnRecord
	if err := json.Unmarshal([]byte(raw), &rec); err != nil {
		return nil, err
	}
	rec.Seq = -1
	if seq, ok := values[1].(string); ok {
		rec.Seq, _ = strconv.ParseInt(seq, 10, 64)
	}
	return &rec, nil
}

func (r *RedisRegistry) PutConn(ctx context.Context, rec ConnRecord) error {
	data, _ := json.Marshal(rec)
	return r.c.Set(ctx, r.connKey(rec.ConnID), data, ConnTTL).Err()
}

func (r *RedisRegistry) DeleteConn(ctx context.Context, connID string) error {
	return r.c.Del(ctx, r.connKey(connID), r.seqKey(connID)).Err()
}

var advanceSeq = redis.NewScript(`
local current = redis.call("GET", KEYS[1])
if current == false or tonumber(current) < tonumber(ARGV[1]) then
  redis.call("SET", KEYS[1], ARGV[1], "PX", ARGV[2])
end
return 0`)

func (r *RedisRegistry) AdvanceSeq(ctx context.Context, connID string, seq int64) error {
	return advanceSeq.Run(ctx, r.c, []string{r.seqKey(connID)}, seq, ConnTTL.Milliseconds()).Err()
}

func (r *RedisRegistry) PutMember(ctx context.Context, roomID string, m Member) error {
	data, _ := json.Marshal(m)
	key := r.room(roomID, "members")
	pipe := r.c.TxPipeline()
	pipe.HSet(ctx, key, m.ConnID, data)
	pipe.PExpire(ctx, key, ConnTTL)
	_, err := pipe.Exec(ctx)
	return err
}

// SetDelivered writes the room's delivery cursor.
func (r *RedisRegistry) SetDelivered(ctx context.Context, roomID string, delivered map[string]int64) error {
	if len(delivered) == 0 {
		return nil
	}
	values := make([]any, 0, 2*len(delivered))
	for connID, version := range delivered {
		values = append(values, connID, version)
	}
	key := r.room(roomID, "cursor")
	pipe := r.c.TxPipeline()
	pipe.HSet(ctx, key, values...)
	pipe.PExpire(ctx, key, ConnTTL)
	_, err := pipe.Exec(ctx)
	return err
}

func (r *RedisRegistry) DeleteMember(ctx context.Context, roomID, connID string) error {
	pipe := r.c.TxPipeline()
	pipe.HDel(ctx, r.room(roomID, "members"), connID)
	pipe.HDel(ctx, r.room(roomID, "cursor"), connID)
	_, err := pipe.Exec(ctx)
	return err
}

func (r *RedisRegistry) ListMembers(ctx context.Context, roomID string) ([]Member, error) {
	pipe := r.c.Pipeline()
	members := pipe.HGetAll(ctx, r.room(roomID, "members"))
	cursor := pipe.HGetAll(ctx, r.room(roomID, "cursor"))
	if _, err := pipe.Exec(ctx); err != nil && !errors.Is(err, redis.Nil) {
		return nil, err
	}
	delivered := cursor.Val()
	out := make([]Member, 0, len(members.Val()))
	for _, value := range members.Val() {
		var m Member
		if json.Unmarshal([]byte(value), &m) == nil {
			m.Delivered, _ = strconv.ParseInt(delivered[m.ConnID], 10, 64)
			out = append(out, m)
		}
	}
	return out, nil
}

var acquireLease = redis.NewScript(`
local owner = redis.call("GET", KEYS[1])
if owner == false or owner == ARGV[1] then
  redis.call("SET", KEYS[1], ARGV[1], "PX", ARGV[2])
  return 1
end
return 0`)

var releaseLease = redis.NewScript(`
if redis.call("GET", KEYS[1]) == ARGV[1] then redis.call("DEL", KEYS[1]) end
return 0`)

func (r *RedisRegistry) AcquireLease(ctx context.Context, roomID, owner string, ttl time.Duration) (bool, error) {
	got, err := acquireLease.Run(ctx, r.c, []string{r.room(roomID, "lease")}, owner, ttl.Milliseconds()).Int()
	return got == 1, err
}

func (r *RedisRegistry) ReleaseLease(ctx context.Context, roomID, owner string) error {
	return releaseLease.Run(ctx, r.c, []string{r.room(roomID, "lease")}, owner).Err()
}

func (r *RedisRegistry) SetHostOffline(ctx context.Context, roomID string, since int64) error {
	return r.c.Set(ctx, r.room(roomID, "host"), since, ConnTTL).Err()
}

func (r *RedisRegistry) ClearHostOffline(ctx context.Context, roomID string) error {
	return r.c.Del(ctx, r.room(roomID, "host")).Err()
}

func (r *RedisRegistry) HostOfflineSince(ctx context.Context, roomID string) (int64, error) {
	since, err := r.c.Get(ctx, r.room(roomID, "host")).Int64()
	if errors.Is(err, redis.Nil) {
		return 0, nil
	}
	return since, err
}

func (r *RedisRegistry) AddRoom(ctx context.Context, roomID string) error {
	return r.c.SAdd(ctx, r.roomsKey(), roomID).Err()
}

func (r *RedisRegistry) RemoveRoom(ctx context.Context, roomID string) error {
	if err := r.c.SRem(ctx, r.roomsKey(), roomID).Err(); err != nil {
		return err
	}
	return r.c.Del(ctx, r.room(roomID, "members"), r.room(roomID, "cursor"), r.room(roomID, "host"), r.room(roomID, "lease")).Err()
}

func (r *RedisRegistry) ListRooms(ctx context.Context) ([]string, error) {
	return r.c.SMembers(ctx, r.roomsKey()).Result()
}

var _ Registry = (*RedisRegistry)(nil)
