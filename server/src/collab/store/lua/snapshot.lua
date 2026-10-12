-- Read the whole room state at one version, atomically.
--
-- ARGV[1] prefix
-- ARGV[2] collections ["components", ...]
--
-- Returns false when the room is not open, otherwise
-- {version, docFlat, {{collection, {{id, entityFlat}, ...}}, ...}}
-- where the *Flat values are HGETALL arrays of field, encoded value.

local prefix = ARGV[1]
local collections = cjson.decode(ARGV[2])
local meta = prefix .. ":meta"
if redis.call("HGET", meta, "status") ~= "open" then return false end

local version = tonumber(redis.call("HGET", meta, "version"))
local doc = redis.call("HGETALL", prefix .. ":doc")
local out = {}
for _, collection in ipairs(collections) do
  local entities = {}
  for _, id in ipairs(redis.call("SMEMBERS", prefix .. ":idx:" .. collection)) do
    entities[#entities + 1] = {id, redis.call("HGETALL", prefix .. ":e:" .. collection .. ":" .. id)}
  end
  out[#out + 1] = {collection, entities}
end
return {version, doc, out}
