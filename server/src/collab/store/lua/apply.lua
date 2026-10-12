-- Apply one patch to a room atomically: field-level merge, remove-wins over a stale edit, soft-lock
-- guarding, then version + stream entry. The reference implementation is merge.ts; the fixture
-- suite in __fixtures__/merge.fixtures.ts holds this script to it.
--
-- Values arrive and are stored JSON-encoded by the caller, so "unchanged" is a string compare and
-- no value is ever re-encoded here.
--
-- KEYS: none (every key derives from ARGV[1], all in the room's hash slot).
-- ARGV[1] prefix            "c:{<roomId>}"
-- ARGV[2] wire patch        {"doc":[[field, enc]...], "ent":[[collection, id, del, [[field, enc]...], [field...]]...]}
-- ARGV[3] sender version
-- ARGV[4] sender id
-- ARGV[5] op id
-- ARGV[6] guarded fields    {"<collection>": ["field", ...]}
-- ARGV[7] immutable doc     ["diagramId"]
-- ARGV[8] entry log size
--
-- Returns {"applied", version, effectiveWire} | {"noop", version} | {"not_open"}

local prefix = ARGV[1]
local wire = cjson.decode(ARGV[2])
local senderVersion = tonumber(ARGV[3])
local sender = ARGV[4]
local opId = ARGV[5]
local guarded = cjson.decode(ARGV[6])
local immutable = {}
for _, f in ipairs(cjson.decode(ARGV[7])) do immutable[f] = true end
local logSize = tonumber(ARGV[8])

local meta = prefix .. ":meta"
if redis.call("HGET", meta, "status") ~= "open" then return {"not_open"} end
local version = tonumber(redis.call("HGET", meta, "version"))
local nextVersion = version + 1

local docKey = prefix .. ":doc"
local tombKey = prefix .. ":tomb"
local outDoc = {}
local outEnt = {}

for _, d in ipairs(wire["doc"] or {}) do
  local field, enc = d[1], d[2]
  if not immutable[field] then
    local current = redis.call("HGET", docKey, field)
    if current == false or current ~= enc then
      redis.call("HSET", docKey, field, enc)
      outDoc[#outDoc + 1] = {field, enc}
    end
  end
end

for _, e in ipairs(wire["ent"] or {}) do
  local collection, id, del, sets, unsets = e[1], e[2], e[3], e[4] or {}, e[5] or {}
  local entityKey = prefix .. ":e:" .. collection .. ":" .. id
  local indexKey = prefix .. ":idx:" .. collection
  local tomb = collection .. "/" .. id
  local exists = redis.call("EXISTS", entityKey) == 1

  if del == 1 then
    if exists then
      redis.call("DEL", entityKey)
      redis.call("SREM", indexKey, id)
      redis.call("HSET", tombKey, tomb, nextVersion)
      outEnt[#outEnt + 1] = {collection, id, 1, {}, {}}
    end
  else
    local deletedAt = redis.call("HGET", tombKey, tomb)
    local stale = deletedAt ~= false and senderVersion < tonumber(deletedAt)
    if not stale then
      local blocked = {}
      local holder = redis.call("GET", prefix .. ":lock:" .. id)
      if holder ~= false and holder ~= sender and guarded[collection] then
        for _, f in ipairs(guarded[collection]) do blocked[f] = true end
      end

      local appliedSets = {}
      local appliedUnsets = {}
      for _, s in ipairs(sets) do
        local field, enc = s[1], s[2]
        if not blocked[field] then
          local current = redis.call("HGET", entityKey, field)
          if current == false or current ~= enc then appliedSets[#appliedSets + 1] = {field, enc} end
        end
      end
      for _, field in ipairs(unsets) do
        if not blocked[field] and redis.call("HEXISTS", entityKey, field) == 1 then
          appliedUnsets[#appliedUnsets + 1] = field
        end
      end

      local changes = #appliedSets > 0 or #appliedUnsets > 0
      -- A field-only removal cannot create an entity.
      if changes and (exists or #appliedSets > 0) then
        if not exists then
          -- Presence marker: an entity whose every field is removed still exists.
          redis.call("HSET", entityKey, "", "1")
          redis.call("SADD", indexKey, id)
        end
        for _, s in ipairs(appliedSets) do redis.call("HSET", entityKey, s[1], s[2]) end
        for _, field in ipairs(appliedUnsets) do redis.call("HDEL", entityKey, field) end
        if deletedAt ~= false then redis.call("HDEL", tombKey, tomb) end
        outEnt[#outEnt + 1] = {collection, id, 0, appliedSets, appliedUnsets}
      end
    end
  end
end

if #outDoc == 0 and #outEnt == 0 then return {"noop", version} end

local effective = cjson.encode({doc = outDoc, ent = outEnt})
redis.call("HSET", meta, "version", nextVersion)
redis.call("XADD", prefix .. ":ops", "MAXLEN", "~", logSize, nextVersion .. "-0",
  "kind", "entry", "opId", opId, "sender", sender, "patch", effective)
return {"applied", nextVersion, effective}
