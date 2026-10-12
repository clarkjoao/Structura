-- Close a room once: mark it closed, append a close event to its stream so every relay tells its
-- sockets, drop the diagram state, and let the room's remaining keys expire.
--
-- ARGV[1] prefix
-- ARGV[2] reason
-- ARGV[3] collections ["components", ...]
-- ARGV[4] linger ms (how long late joins still learn the session closed)
-- ARGV[5] room id
-- ARGV[6] host lease sorted-set key
--
-- Returns 1 for the call that closed it, 0 otherwise.

local prefix = ARGV[1]
local meta = prefix .. ":meta"
local status = redis.call("HGET", meta, "status")
if status == false or status == "closed" then return 0 end

local version = tonumber(redis.call("HGET", meta, "version"))
redis.call("HSET", meta, "status", "closed")
redis.call("XADD", prefix .. ":ops", version .. "-1", "kind", "closed", "reason", ARGV[2])

for _, collection in ipairs(cjson.decode(ARGV[3])) do
  local indexKey = prefix .. ":idx:" .. collection
  for _, id in ipairs(redis.call("SMEMBERS", indexKey)) do
    redis.call("DEL", prefix .. ":e:" .. collection .. ":" .. id)
  end
  redis.call("DEL", indexKey)
end
redis.call("DEL", prefix .. ":doc", prefix .. ":tomb", prefix .. ":seed", prefix .. ":members")

local linger = tonumber(ARGV[4])
redis.call("PEXPIRE", meta, linger)
redis.call("PEXPIRE", prefix .. ":ops", linger)
redis.call("ZREM", ARGV[6], ARGV[5])
return 1
