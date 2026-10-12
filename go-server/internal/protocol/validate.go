package protocol

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"regexp"
	"unicode/utf8"
)

var errInvalid = errors.New("protocol: invalid value")

var dangerousKeys = map[string]bool{"__proto__": true, "constructor": true, "prototype": true}

var roomIDPattern = regexp.MustCompile(`^[A-Za-z0-9_-]{1,128}$`)

// UTF16Len is the length of s as JavaScript counts it (`string.length`): UTF-16 code units.
// Invalid UTF-8 bytes count one each.
func UTF16Len(s string) int {
	n := 0
	for i := 0; i < len(s); {
		r, size := utf8.DecodeRuneInString(s[i:])
		if r >= 0x10000 {
			n += 2
		} else {
			n++
		}
		i += size
	}
	return n
}

// UTF16LenBytes is UTF16Len for a byte slice.
func UTF16LenBytes(b []byte) int {
	n := 0
	for i := 0; i < len(b); {
		r, size := utf8.DecodeRune(b[i:])
		if r >= 0x10000 {
			n += 2
		} else {
			n++
		}
		i += size
	}
	return n
}

// IsSafeKey rejects empty, oversized and prototype-polluting keys.
func IsSafeKey(key string) bool {
	n := UTF16Len(key)
	return n > 0 && n <= 256 && !dangerousKeys[key]
}

// IsRoomID restricts room ids to a plain alphabet: they end up inside storage keys.
func IsRoomID(id string) bool {
	return roomIDPattern.MatchString(id) && IsSafeKey(id)
}

func firstByte(raw []byte) byte {
	for _, b := range raw {
		switch b {
		case ' ', '\t', '\n', '\r':
			continue
		}
		return b
	}
	return 0
}

func isObject(raw []byte) bool { return firstByte(raw) == '{' }
func isArray(raw []byte) bool  { return firstByte(raw) == '[' }
func isString(raw []byte) bool { return firstByte(raw) == '"' }
func isNull(raw []byte) bool   { return bytes.Equal(bytes.TrimSpace(raw), []byte("null")) }

// object reads a JSON object's members; ok is false for anything that is not an object.
func object(raw []byte) (map[string]json.RawMessage, bool) {
	if !isObject(raw) {
		return nil, false
	}
	var out map[string]json.RawMessage
	if err := json.Unmarshal(raw, &out); err != nil {
		return nil, false
	}
	return out, true
}

// arrayItems reads a JSON array's elements; ok is false for anything that is not an array.
func arrayItems(raw []byte) ([]json.RawMessage, bool) {
	if !isArray(raw) {
		return nil, false
	}
	var items []json.RawMessage
	if err := json.Unmarshal(raw, &items); err != nil {
		return nil, false
	}
	return items, true
}

func stringValue(raw []byte) (string, bool) {
	if !isString(raw) {
		return "", false
	}
	var s string
	if err := json.Unmarshal(raw, &s); err != nil {
		return "", false
	}
	return s, true
}

// compact returns the value without insignificant whitespace, as JSON.stringify writes it.
func compact(raw []byte) json.RawMessage {
	var buf bytes.Buffer
	if err := json.Compact(&buf, raw); err != nil {
		return append(json.RawMessage(nil), raw...)
	}
	return buf.Bytes()
}

// objectKeys lists the keys of a JSON object in document order (the last of a repeated key
// counts, as in JavaScript, but keeps its first place).
func objectKeys(raw []byte) []string {
	dec := json.NewDecoder(bytes.NewReader(raw))
	if tok, err := dec.Token(); err != nil || tok != json.Delim('{') {
		return nil
	}
	var keys []string
	seen := map[string]bool{}
	for dec.More() {
		tok, err := dec.Token()
		if err != nil {
			return keys
		}
		key, _ := tok.(string)
		if !seen[key] {
			seen[key] = true
			keys = append(keys, key)
		}
		var skip json.RawMessage
		if err := dec.Decode(&skip); err != nil {
			return keys
		}
	}
	return keys
}

// HasOnlySafeKeys is true when no object key anywhere in raw could pollute a prototype, and
// nesting stays within 64 levels.
func HasOnlySafeKeys(raw []byte) bool {
	dec := json.NewDecoder(bytes.NewReader(raw))
	dec.UseNumber()
	type frame struct {
		object    bool
		expectKey bool
	}
	var stack []frame
	valueDone := func() {
		if n := len(stack); n > 0 && stack[n-1].object {
			stack[n-1].expectKey = true
		}
	}
	for {
		tok, err := dec.Token()
		if err == io.EOF {
			return len(stack) == 0
		}
		if err != nil {
			return false
		}
		switch t := tok.(type) {
		case json.Delim:
			switch t {
			case '{', '[':
				if len(stack) > 64 {
					return false
				}
				stack = append(stack, frame{object: t == '{', expectKey: t == '{'})
			default:
				stack = stack[:len(stack)-1]
				valueDone()
			}
		case string:
			if n := len(stack); n > 0 && stack[n-1].object && stack[n-1].expectKey {
				if dangerousKeys[t] {
					return false
				}
				stack[n-1].expectKey = false
				continue
			}
			valueDone()
		default:
			valueDone()
		}
	}
}

// ParseUser validates a participant identity.
func ParseUser(raw []byte) (User, bool) {
	fields, ok := object(raw)
	if !ok {
		return User{}, false
	}
	id, okID := stringValue(fields["id"])
	name, okName := stringValue(fields["name"])
	color, okColor := stringValue(fields["color"])
	if !okID || !okName || !okColor {
		return User{}, false
	}
	idLen := UTF16Len(id)
	if idLen == 0 || idLen > 128 || UTF16Len(name) > 128 || UTF16Len(color) > 32 {
		return User{}, false
	}
	return User{ID: id, Name: name, Color: color}, true
}

func parseEntityPatch(raw []byte) (*EntityPatch, bool) {
	if isNull(raw) {
		return &EntityPatch{Delete: true}, true
	}
	fields, ok := object(raw)
	if !ok {
		return nil, false
	}
	out := &EntityPatch{}
	for key := range fields {
		if key != "set" && key != "unset" {
			return nil, false
		}
	}
	if setRaw, present := fields["set"]; present {
		set, ok := object(setRaw)
		if !ok || !HasOnlySafeKeys(setRaw) {
			return nil, false
		}
		out.Set = make(map[string]json.RawMessage, len(set))
		for field, value := range set {
			if !IsSafeKey(field) {
				return nil, false
			}
			out.Set[field] = compact(value)
		}
	}
	if unsetRaw, present := fields["unset"]; present {
		items, ok := arrayItems(unsetRaw)
		if !ok {
			return nil, false
		}
		for _, item := range items {
			field, ok := stringValue(item)
			if !ok || !IsSafeKey(field) {
				return nil, false
			}
			out.Unset = append(out.Unset, field)
		}
	}
	return out, true
}

// ParsePatch reads and validates a diagram patch (isDiagramPatch).
func ParsePatch(raw []byte) (Patch, bool) {
	fields, ok := object(raw)
	if !ok {
		return Patch{}, false
	}
	var out Patch
	for key := range fields {
		if key != "doc" && key != "entities" {
			return Patch{}, false
		}
	}
	if docRaw, present := fields["doc"]; present {
		doc, ok := object(docRaw)
		if !ok || !HasOnlySafeKeys(docRaw) {
			return Patch{}, false
		}
		out.Doc = make(map[string]json.RawMessage, len(doc))
		for field, value := range doc {
			if !IsDocField(field) {
				return Patch{}, false
			}
			out.Doc[field] = compact(value)
		}
	}
	if entitiesRaw, present := fields["entities"]; present {
		entities, ok := object(entitiesRaw)
		if !ok {
			return Patch{}, false
		}
		out.Entities = make(map[string]map[string]*EntityPatch, len(entities))
		for collection, byIDRaw := range entities {
			byID, ok := object(byIDRaw)
			if !IsCollection(collection) || !ok {
				return Patch{}, false
			}
			patches := make(map[string]*EntityPatch, len(byID))
			for id, entityRaw := range byID {
				if !IsSafeKey(id) {
					return Patch{}, false
				}
				entityPatch, ok := parseEntityPatch(entityRaw)
				if !ok {
					return Patch{}, false
				}
				patches[id] = entityPatch
			}
			out.Entities[collection] = patches
			if out.Order == nil {
				out.Order = map[string][]string{}
			}
			out.Order[collection] = objectKeys(byIDRaw)
		}
	}
	return out, true
}

// ParseState reads and validates a whole diagram (isDiagramState). Collections it does not know
// are dropped.
func ParseState(raw []byte) (State, bool) {
	fields, ok := object(raw)
	if !ok {
		return State{}, false
	}
	doc, okDoc := object(fields["doc"])
	entities, okEntities := object(fields["entities"])
	if !okDoc || !okEntities {
		return State{}, false
	}
	state := EmptyState()
	for field, value := range doc {
		if !IsDocField(field) {
			return State{}, false
		}
		state.Doc[field] = compact(value)
	}
	for _, collection := range Collections {
		byID, ok := object(entities[collection])
		if !ok {
			return State{}, false
		}
		state.Order[collection] = objectKeys(entities[collection])
		for id, entityRaw := range byID {
			entity, ok := object(entityRaw)
			if !IsSafeKey(id) || !ok {
				return State{}, false
			}
			out := make(Entity, len(entity))
			for f, v := range entity {
				out[f] = compact(v)
			}
			state.Entities[collection][id] = out
		}
	}
	if !HasOnlySafeKeys(raw) {
		return State{}, false
	}
	return state, true
}
