-- Soft locks: one holder per entity, with a TTL so a vanished holder never keeps it.
--
-- ARGV[1] lock key
-- ARGV[2] action: "acquire" | "release"
-- ARGV[3] clientId
-- ARGV[4] ttl ms (acquire)
--
-- acquire returns {1, holder} or {0, holder}; release returns 1 when it released.

local key, action, client = ARGV[1], ARGV[2], ARGV[3]
local holder = redis.call("GET", key)

if action == "acquire" then
  if holder ~= false and holder ~= client then return {0, holder} end
  redis.call("SET", key, client, "PX", tonumber(ARGV[4]))
  return {1, client}
end

if holder == client then
  redis.call("DEL", key)
  return 1
end
return 0
