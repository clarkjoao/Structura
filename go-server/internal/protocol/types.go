// Package protocol is collaboration protocol v3 as the Go relay speaks it: the same wire contract
// as server/src/collab/protocol.ts, which stays the reference. Values inside entities and doc
// fields are kept as raw JSON, so the relay never re-encodes what a client wrote.
package protocol

import (
	"bytes"
	"encoding/json"
	"sort"
)

// Version is the protocol version this relay speaks.
const Version = 3

// Collections are the keyed entity collections of a diagram, in merge order.
var Collections = []string{
	"components",
	"connections",
	"flows",
	"iconLibrary",
	"nodeLayouts",
	"edgeLayouts",
	"versions",
}

// DocFields are the top-level scalar fields of a diagram, assigned whole.
var DocFields = []string{
	"diagramId",
	"diagramName",
	"level",
	"domain",
	"description",
	"activeVersionId",
	"compareVersionId",
}

// ImmutableDocFields are fixed at seed time; a patch may not change them.
var ImmutableDocFields = map[string]bool{"diagramId": true}

// LockGuardedFields may only be written by the holder of an entity's soft lock.
var LockGuardedFields = map[string][]string{
	"nodeLayouts": {"x", "y", "width", "height"},
	"components":  {"name", "description"},
	"connections": {"label", "description"},
}

var collectionSet = toSet(Collections)
var docFieldSet = toSet(DocFields)

func toSet(list []string) map[string]bool {
	out := make(map[string]bool, len(list))
	for _, item := range list {
		out[item] = true
	}
	return out
}

// IsCollection reports whether name is one of the diagram collections.
func IsCollection(name string) bool { return collectionSet[name] }

// IsDocField reports whether name is one of the diagram doc fields.
func IsDocField(name string) bool { return docFieldSet[name] }

// Entity is a flat record merged field by field. Values are compact JSON.
type Entity map[string]json.RawMessage

// State is a whole diagram: doc fields plus every collection.
type State struct {
	Doc      map[string]json.RawMessage
	Entities map[string]map[string]Entity
	// Order keeps each collection's ids in creation order, as a JavaScript object keeps its keys:
	// the client lists and stacks entities in that order.
	Order map[string][]string
}

// EmptyState has every collection present and empty.
func EmptyState() State {
	entities := make(map[string]map[string]Entity, len(Collections))
	for _, c := range Collections {
		entities[c] = map[string]Entity{}
	}
	return State{Doc: map[string]json.RawMessage{}, Entities: entities, Order: map[string][]string{}}
}

// Created records that an entity was added at the end of its collection.
func (s *State) Created(collection, id string) {
	if s.Order == nil {
		s.Order = map[string][]string{}
	}
	s.Order[collection] = append(s.Order[collection], id)
}

// Removed forgets an entity's place; a later re-creation goes to the end.
func (s *State) Removed(collection, id string) {
	ids := s.Order[collection]
	for i, other := range ids {
		if other == id {
			s.Order[collection] = append(ids[:i:i], ids[i+1:]...)
			return
		}
	}
}

// IDs lists a collection's ids in creation order; ids with no recorded place come last, sorted.
func (s State) IDs(collection string) []string {
	present := s.Entities[collection]
	out := make([]string, 0, len(present))
	seen := make(map[string]bool, len(present))
	for _, id := range s.Order[collection] {
		if _, ok := present[id]; ok && !seen[id] {
			seen[id] = true
			out = append(out, id)
		}
	}
	if len(out) == len(present) {
		return out
	}
	var rest []string
	for id := range present {
		if !seen[id] {
			rest = append(rest, id)
		}
	}
	sort.Strings(rest)
	return append(out, rest...)
}

// Clone deep-copies the maps (values are immutable byte slices and are shared).
func (s State) Clone() State {
	out := EmptyState()
	for k, v := range s.Doc {
		out.Doc[k] = v
	}
	for _, c := range Collections {
		for id, entity := range s.Entities[c] {
			copyEntity := make(Entity, len(entity))
			for f, v := range entity {
				copyEntity[f] = v
			}
			out.Entities[c][id] = copyEntity
		}
		out.Order[c] = append([]string(nil), s.Order[c]...)
	}
	return out
}

// MarshalJSON writes {"doc":{…},"entities":{…every collection…}}.
func (s State) MarshalJSON() ([]byte, error) {
	var buf bytes.Buffer
	buf.WriteString(`{"doc":`)
	writeRawObject(&buf, s.Doc)
	buf.WriteString(`,"entities":{`)
	for i, c := range Collections {
		if i > 0 {
			buf.WriteByte(',')
		}
		writeString(&buf, c)
		buf.WriteString(":{")
		for j, id := range s.IDs(c) {
			if j > 0 {
				buf.WriteByte(',')
			}
			writeString(&buf, id)
			buf.WriteByte(':')
			writeRawObject(&buf, s.Entities[c][id])
		}
		buf.WriteByte('}')
	}
	buf.WriteString("}}")
	return buf.Bytes(), nil
}

// EntityPatch changes one entity: Delete removes it; otherwise Set assigns fields and Unset
// removes fields. A field set to null keeps the value null.
type EntityPatch struct {
	Delete bool
	Set    map[string]json.RawMessage
	Unset  []string
}

// MarshalJSON writes null for a removal, otherwise {"set":…,"unset":…} with empty parts left out.
func (p *EntityPatch) MarshalJSON() ([]byte, error) {
	if p == nil || p.Delete {
		return []byte("null"), nil
	}
	var buf bytes.Buffer
	buf.WriteByte('{')
	wrote := false
	if len(p.Set) > 0 {
		buf.WriteString(`"set":`)
		writeRawObject(&buf, p.Set)
		wrote = true
	}
	if len(p.Unset) > 0 {
		if wrote {
			buf.WriteByte(',')
		}
		buf.WriteString(`"unset":[`)
		for i, f := range p.Unset {
			if i > 0 {
				buf.WriteByte(',')
			}
			writeString(&buf, f)
		}
		buf.WriteByte(']')
	}
	buf.WriteByte('}')
	return buf.Bytes(), nil
}

// Patch is a change to a diagram.
type Patch struct {
	Doc      map[string]json.RawMessage
	Entities map[string]map[string]*EntityPatch
	// Order keeps each collection's ids in the order the patch lists them: entities a patch
	// creates are created in that order, on every side.
	Order map[string][]string
}

// IDs lists the ids a patch touches in a collection, in its order.
func (p Patch) IDs(collection string) []string {
	present := p.Entities[collection]
	out := make([]string, 0, len(present))
	seen := make(map[string]bool, len(present))
	for _, id := range p.Order[collection] {
		if _, ok := present[id]; ok && !seen[id] {
			seen[id] = true
			out = append(out, id)
		}
	}
	if len(out) == len(present) {
		return out
	}
	var rest []string
	for id := range present {
		if !seen[id] {
			rest = append(rest, id)
		}
	}
	sort.Strings(rest)
	return append(out, rest...)
}

// Touch records an entity change, keeping the order of first touch.
func (p *Patch) Touch(collection, id string, change *EntityPatch) {
	if p.Entities == nil {
		p.Entities = map[string]map[string]*EntityPatch{}
	}
	if p.Entities[collection] == nil {
		p.Entities[collection] = map[string]*EntityPatch{}
	}
	if _, already := p.Entities[collection][id]; !already {
		if p.Order == nil {
			p.Order = map[string][]string{}
		}
		p.Order[collection] = append(p.Order[collection], id)
	}
	p.Entities[collection][id] = change
}

// IsEmpty reports whether the patch changes nothing at all.
func (p Patch) IsEmpty() bool {
	if len(p.Doc) > 0 {
		return false
	}
	for _, byID := range p.Entities {
		if len(byID) > 0 {
			return false
		}
	}
	return true
}

// MarshalJSON leaves out empty parts, as the TypeScript relay does.
func (p Patch) MarshalJSON() ([]byte, error) {
	var buf bytes.Buffer
	buf.WriteByte('{')
	wrote := false
	if len(p.Doc) > 0 {
		buf.WriteString(`"doc":`)
		writeRawObject(&buf, p.Doc)
		wrote = true
	}
	if len(p.Entities) > 0 {
		if wrote {
			buf.WriteByte(',')
		}
		buf.WriteString(`"entities":{`)
		first := true
		for _, c := range Collections {
			byID, ok := p.Entities[c]
			if !ok {
				continue
			}
			if !first {
				buf.WriteByte(',')
			}
			first = false
			writeString(&buf, c)
			buf.WriteString(":{")
			for j, id := range p.IDs(c) {
				if j > 0 {
					buf.WriteByte(',')
				}
				writeString(&buf, id)
				buf.WriteByte(':')
				encoded, _ := byID[id].MarshalJSON()
				buf.Write(encoded)
			}
			buf.WriteByte('}')
		}
		buf.WriteByte('}')
	}
	buf.WriteByte('}')
	return buf.Bytes(), nil
}

// UnmarshalJSON reads and validates a patch (see ParsePatch).
func (p *Patch) UnmarshalJSON(data []byte) error {
	parsed, ok := ParsePatch(data)
	if !ok {
		return errInvalid
	}
	*p = parsed
	return nil
}

// Entry is one accepted, ordered change.
type Entry struct {
	Version int64  `json:"version"`
	OpID    string `json:"opId"`
	Sender  string `json:"sender"`
	Patch   Patch  `json:"patch"`
}

// User is a participant's identity as the client presents it.
type User struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Color string `json:"color"`
}

// Participant is a member of a room.
type Participant struct {
	ClientID string `json:"clientId"`
	User     User   `json:"user"`
	Role     string `json:"role"`
}

// Point is a cursor position in flow coordinates.
type Point struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

// CursorEntry is one participant's cursor; a nil Cursor means it left the canvas.
type CursorEntry struct {
	ClientID        string  `json:"clientId"`
	Cursor          *Point  `json:"cursor"`
	ActiveElementID *string `json:"activeElementId"`
}

func sortedKeys[V any](m map[string]V) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	return keys
}

func writeRawObject(buf *bytes.Buffer, m map[string]json.RawMessage) {
	buf.WriteByte('{')
	for i, k := range sortedKeys(m) {
		if i > 0 {
			buf.WriteByte(',')
		}
		writeString(buf, k)
		buf.WriteByte(':')
		buf.Write(m[k])
	}
	buf.WriteByte('}')
}

func writeString(buf *bytes.Buffer, s string) {
	encoded, _ := Marshal(s)
	buf.Write(encoded)
}

// Marshal encodes like JSON.stringify: no HTML escaping, no trailing newline.
func Marshal(v any) ([]byte, error) {
	var buf bytes.Buffer
	enc := json.NewEncoder(&buf)
	enc.SetEscapeHTML(false)
	if err := enc.Encode(v); err != nil {
		return nil, err
	}
	out := buf.Bytes()
	return out[:len(out)-1], nil
}

// MustMarshal is Marshal for values that always encode.
func MustMarshal(v any) []byte {
	out, err := Marshal(v)
	if err != nil {
		panic(err)
	}
	return out
}
