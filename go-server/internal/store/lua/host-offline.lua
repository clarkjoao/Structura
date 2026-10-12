-- Flip a room's host to offline exactly once, so only one relay announces it.
--
-- ARGV[1] meta key
-- Returns 1 for the call that flipped it.

local meta = ARGV[1]
if redis.call("HGET", meta, "hostOnline") == "1" then
  redis.call("HSET", meta, "hostOnline", "0")
  return 1
end
return 0
