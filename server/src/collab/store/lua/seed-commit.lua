-- Write a parsed seed and open the room at version 0, atomically. The caller parses and validates
-- the seed and encodes every value, so this script only stores strings.
--
-- A large seed is written in several calls (a batch of entities each, so no single call holds
-- Redis for long); only the last one opens the room. Until then the room stays in `seeding`
-- and serves nothing.
--
-- ARGV[1] prefix
-- ARGV[2] wire batch {"doc":[[field, enc]...], "ent":[[collection, id, [[field, enc]...]]...]}
-- ARGV[3] "1" to open the room after this batch
--
-- Returns 1 when written, 0 when the room is not seeding.

local prefix = ARGV[1]
local meta = prefix .. ":meta"
if redis.call("HGET", meta, "status") ~= "seeding" then return 0 end

local wire = cjson.decode(ARGV[2])
for _, d in ipairs(wire["doc"] or {}) do
  redis.call("HSET", prefix .. ":doc", d[1], d[2])
end
for _, e in ipairs(wire["ent"] or {}) do
  local collection, id, fields = e[1], e[2], e[3] or {}
  local entityKey = prefix .. ":e:" .. collection .. ":" .. id
  redis.call("HSET", entityKey, "", "1")
  for _, f in ipairs(fields) do redis.call("HSET", entityKey, f[1], f[2]) end
  redis.call("SADD", prefix .. ":idx:" .. collection, id)
end

if ARGV[3] == "1" then
  redis.call("DEL", prefix .. ":seed")
  redis.call("HSET", meta, "status", "open", "version", 0)
end
return 1
