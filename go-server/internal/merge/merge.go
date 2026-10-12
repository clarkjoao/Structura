// Package merge is the room-side merge: field-level last-writer-wins, remove-wins over a
// concurrent edit, and soft-lock enforcement. It is a port of server/src/collab/merge.ts, which
// stays the reference; the shared fixtures in testdata hold both to the same results.
package merge

import (
	"bytes"
	"encoding/json"

	"github.com/clarkjoao/structura/go-server/internal/protocol"
)

// Context describes who sent a patch and what they had seen.
type Context struct {
	// SenderVersion is the room version the sender had applied when it composed the patch.
	SenderVersion int64
	SenderID      string
	// LockHolder returns the holder of an entity's soft lock, or "" when it is free.
	LockHolder func(entityID string) string
}

// Target is the state a patch merges into, in place.
type Target struct {
	State protocol.State
	// Tombstones maps `collection/entityId` to the version that removed the entity.
	Tombstones map[string]int64
}

// TombstoneKey names an entity's removal record.
func TombstoneKey(collection, entityID string) string {
	return collection + "/" + entityID
}

// Same reports whether two encoded values are the same value.
func Same(a, b json.RawMessage) bool { return bytes.Equal(a, b) }

// Apply merges patch into target as the change that will get nextVersion, and returns the part
// that took effect. An empty result means nothing changed and no version is used.
func Apply(target *Target, patch protocol.Patch, nextVersion int64, ctx Context) protocol.Patch {
	var effective protocol.Patch

	for field, value := range patch.Doc {
		if protocol.ImmutableDocFields[field] {
			continue
		}
		if current, present := target.State.Doc[field]; present && Same(current, value) {
			continue
		}
		target.State.Doc[field] = value
		if effective.Doc == nil {
			effective.Doc = map[string]json.RawMessage{}
		}
		effective.Doc[field] = value
	}

	for _, collection := range protocol.Collections {
		byID, ok := patch.Entities[collection]
		if !ok {
			continue
		}
		// In the patch's own order, as the TypeScript merge walks Object.entries.
		for _, entityID := range patch.IDs(collection) {
			applied := applyEntity(target, collection, entityID, byID[entityID], nextVersion, ctx)
			if applied == nil {
				continue
			}
			effective.Touch(collection, entityID, applied)
		}
	}
	return effective
}

func guarded(collection, field string) bool {
	for _, f := range protocol.LockGuardedFields[collection] {
		if f == field {
			return true
		}
	}
	return false
}

// applyEntity returns the effective entity patch, or nil when nothing took effect.
func applyEntity(
	target *Target,
	collection, entityID string,
	entityPatch *protocol.EntityPatch,
	nextVersion int64,
	ctx Context,
) *protocol.EntityPatch {
	entities := target.State.Entities[collection]
	existing, exists := entities[entityID]
	tombKey := TombstoneKey(collection, entityID)

	if entityPatch == nil || entityPatch.Delete {
		if !exists {
			return nil
		}
		delete(entities, entityID)
		target.State.Removed(collection, entityID)
		target.Tombstones[tombKey] = nextVersion
		return &protocol.EntityPatch{Delete: true}
	}

	deletedAt, wasDeleted := target.Tombstones[tombKey]
	// Composed before it saw the removal: the removal wins.
	if wasDeleted && ctx.SenderVersion < deletedAt {
		return nil
	}

	blocked := false
	if holder := ctx.LockHolder(entityID); holder != "" && holder != ctx.SenderID {
		blocked = true
	}

	set := map[string]json.RawMessage{}
	var unset []string
	for field, value := range entityPatch.Set {
		if blocked && guarded(collection, field) {
			continue
		}
		if current, present := existing[field]; present && Same(current, value) {
			continue
		}
		set[field] = value
	}
	for _, field := range entityPatch.Unset {
		if blocked && guarded(collection, field) {
			continue
		}
		if _, present := existing[field]; !present {
			continue
		}
		unset = append(unset, field)
	}

	// Nothing to do. A field-only removal of a missing entity lands here too: `unset` only keeps
	// fields the entity has, so it cannot create one.
	if len(set) == 0 && len(unset) == 0 {
		return nil
	}

	entity := existing
	if !exists {
		entity = protocol.Entity{}
	}
	for field, value := range set {
		entity[field] = value
	}
	for _, field := range unset {
		delete(entity, field)
	}
	if !exists {
		entities[entityID] = entity
		target.State.Created(collection, entityID)
	}
	if wasDeleted {
		delete(target.Tombstones, tombKey)
	}

	out := &protocol.EntityPatch{}
	if len(set) > 0 {
		out.Set = set
	}
	if len(unset) > 0 {
		out.Unset = unset
	}
	return out
}

// ApplyEffective applies an already-accepted patch (an entry's) to a state in place.
func ApplyEffective(state *protocol.State, patch protocol.Patch) {
	for field, value := range patch.Doc {
		state.Doc[field] = value
	}
	for _, collection := range protocol.Collections {
		for _, entityID := range patch.IDs(collection) {
			entityPatch := patch.Entities[collection][entityID]
			entities := state.Entities[collection]
			if entityPatch == nil || entityPatch.Delete {
				if _, ok := entities[entityID]; ok {
					delete(entities, entityID)
					state.Removed(collection, entityID)
				}
				continue
			}
			entity, ok := entities[entityID]
			if !ok {
				entity = protocol.Entity{}
				entities[entityID] = entity
				state.Created(collection, entityID)
			}
			for field, value := range entityPatch.Set {
				entity[field] = value
			}
			for _, field := range entityPatch.Unset {
				delete(entity, field)
			}
		}
	}
}
