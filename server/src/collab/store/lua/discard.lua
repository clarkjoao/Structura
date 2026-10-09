-- Remove every key of a room (an abandoned or invalid seed, or a test simulating storage loss).
--
-- ARGV[1] prefix
-- ARGV[2] collections ["components", ...]
-- ARGV[3] room id
-- ARGV[4] host lease sorted-set key

local prefix = ARGV[1]
for _, collection in ipairs(cjson.decode(ARGV[2])) do
  local indexKey = prefix .. ":idx:" .. collection
  for _, id in ipairs(redis.call("SMEMBERS", indexKey)) do
    redis.call("DEL", prefix .. ":e:" .. collection .. ":" .. id)
  end
  redis.call("DEL", indexKey)
end
redis.call("DEL", prefix .. ":meta", prefix .. ":doc", prefix .. ":tomb", prefix .. ":seed",
  prefix .. ":members", prefix .. ":ops")
redis.call("ZREM", ARGV[4], ARGV[3])
return 1
