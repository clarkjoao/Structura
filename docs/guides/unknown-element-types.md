# Unknown element types (F9 behaviour)

After the catch-all C4 descriptor was removed, a component whose `type` is not
in the element registry (and is not a plugin `id/name` form) is sanitized to
`"unknown"` and rendered with the unknown element — it is **not** silently
rewritten to C4 `"component"`.

## Recovery order (before `"unknown"`)

1. Exact id in the element registry → keep
2. Plugin pattern `id/name` → keep
3. Prefix `aws-` / `gcp-` / `azure-` with a missing category → `*-general` if
   that category is registered
4. Else → `"unknown"`

There is no fuzzy matching beyond the provider prefix.

## Why it matters

Corrupt or outdated diagram JSON no longer looks like a valid C4 component.
Users see an explicit unknown node instead of a misleading C4 card.
