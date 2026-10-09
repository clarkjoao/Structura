-- Room membership with expiry, so members of a relay that died drop out on their own.
-- Each field of the members hash is a clientId; its value is "<expiresAt>|<connId>|<participant json>".
--
-- ARGV[1] members key
-- ARGV[2] action: "add" | "remove" | "touch"
-- ARGV[3] now ms
-- add:    ARGV[4] clientId, ARGV[5] connId, ARGV[6] expiresAt, ARGV[7] max, ARGV[8] participant json
-- remove: ARGV[4] clientId, ARGV[5] connId
-- touch:  ARGV[4] expiresAt, ARGV[5..] clientIds
--
-- add returns {1, count} or {0, count}; remove returns the remaining count; touch returns 0.

local key = ARGV[1]
local action = ARGV[2]
local now = tonumber(ARGV[3])

local function parse(value)
  local sep1 = string.find(value, "|", 1, true)
  local sep2 = string.find(value, "|", sep1 + 1, true)
  return tonumber(string.sub(value, 1, sep1 - 1)), string.sub(value, sep1 + 1, sep2 - 1),
    string.sub(value, sep2 + 1)
end

local function prune()
  local all = redis.call("HGETALL", key)
  local count = 0
  for i = 1, #all, 2 do
    local expiresAt = parse(all[i + 1])
    if expiresAt <= now then redis.call("HDEL", key, all[i]) else count = count + 1 end
  end
  return count
end

if action == "add" then
  local clientId, connId, expiresAt, max, participant = ARGV[4], ARGV[5], ARGV[6], tonumber(ARGV[7]), ARGV[8]
  local count = prune()
  local present = redis.call("HEXISTS", key, clientId) == 1
  if not present and count >= max then return {0, count} end
  redis.call("HSET", key, clientId, expiresAt .. "|" .. connId .. "|" .. participant)
  if not present then count = count + 1 end
  return {1, count}
elseif action == "remove" then
  local clientId, connId = ARGV[4], ARGV[5]
  local value = redis.call("HGET", key, clientId)
  if value ~= false then
    local _, owner = parse(value)
    if owner == connId then redis.call("HDEL", key, clientId) end
  end
  return prune()
elseif action == "touch" then
  local expiresAt = ARGV[4]
  for i = 5, #ARGV do
    local value = redis.call("HGET", key, ARGV[i])
    if value ~= false then
      local _, connId, participant = parse(value)
      redis.call("HSET", key, ARGV[i], expiresAt .. "|" .. connId .. "|" .. participant)
    end
  end
  return 0
end
return redis.error_reply("unknown action")
