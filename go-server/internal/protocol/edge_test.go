package protocol

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestParseClientMessageRejectsEveryInvalidField(t *testing.T) {
	join := func(extra string) string {
		return `{"type":"join","protocol":3,"roomId":"r1","user":` + user + extra + `}`
	}
	invalid := []string{
		`{"type":1}`,
		`{"type":"create","protocol":3,"roomId":"r1","user":` + user + `,"seedChunks":1}`,
		`{"type":"join","roomId":"r1","user":` + user + `}`,
		`{"type":"join","protocol":1e400,"roomId":"r1","user":` + user + `}`,
		`{"type":"seed:chunk","index":0,"data":1}`,
		`{"type":"cursor","cursor":1,"activeElementId":null}`,
		`{"type":"cursor","cursor":null,"activeElementId":1}`,
		`{"type":"lock","action":"acquire","entityId":1}`,
		`{"type":"lock","action":"acquire","entityId":"__proto__"}`,
		`{"type":"lock","action":"acquire","entityIds":"c1"}`,
		`{"type":"lock","action":"acquire","entityIds":[1]}`,
		`{"type":"lock","action":"acquire"}`,
		join(`,"resumeFrom":"1"`),
		join(`,"resumeEpoch":1`),
	}
	for _, raw := range invalid {
		if m, ok := ParseClientMessage([]byte(raw)); ok {
			t.Errorf("accepted %s as %+v", raw, m)
		}
	}
}

func TestParseClientMessageClampsSeedSizes(t *testing.T) {
	raw := `{"type":"create","protocol":3,"roomId":"r1","user":` + user + `,"seedChars":1e12,"seedChunks":-1e12}`
	m, ok := ParseClientMessage([]byte(raw))
	if !ok {
		t.Fatal("rejected")
	}
	if m.SeedChars != 1<<31-1 || m.SeedChunks != -1<<31 {
		t.Errorf("not clamped: %d %d", m.SeedChars, m.SeedChunks)
	}
}

func TestDecodeJSONStringUTF16(t *testing.T) {
	units, ok := DecodeJSONStringUTF16([]byte(` "a\"\\\/\b\f\n\r\téé😀" `))
	if !ok {
		t.Fatal("rejected a valid literal")
	}
	want := []uint16{'a', '"', '\\', '/', '\b', '\f', '\n', '\r', '\t', 0xe9, 0xe9, 0xd83d, 0xde00}
	if len(units) != len(want) {
		t.Fatalf("got %v, want %v", units, want)
	}
	for i := range want {
		if units[i] != want[i] {
			t.Fatalf("unit %d: got %x, want %x", i, units[i], want[i])
		}
	}
	for _, bad := range []string{`x`, `"`, `"a"b"`, "\"\x01\"", `"\"`, `"\u12"`, `"\uzzzz"`, `"\x"`} {
		if _, ok := DecodeJSONStringUTF16([]byte(bad)); ok {
			t.Errorf("accepted %q", bad)
		}
	}
}

func TestUTF16LenBytesCountsAstralCharactersTwice(t *testing.T) {
	if n := UTF16LenBytes([]byte("a😀")); n != 3 {
		t.Errorf("got %d", n)
	}
}

func TestJSONHelpersOnMalformedInput(t *testing.T) {
	if b := firstByte([]byte(" \t\n\r{")); b != '{' {
		t.Errorf("firstByte skipped wrong: %q", b)
	}
	if firstByte([]byte("  ")) != 0 {
		t.Error("firstByte of blank")
	}
	if _, ok := stringValue([]byte(`"unterminated`)); ok {
		t.Error("stringValue accepted a broken string")
	}
	if _, ok := arrayItems([]byte(`[1,`)); ok {
		t.Error("arrayItems accepted a broken array")
	}
	if got := compact([]byte(`{ broken`)); string(got) != `{ broken` {
		t.Errorf("compact changed invalid input: %s", got)
	}
	if keys := objectKeys([]byte(`[1]`)); keys != nil {
		t.Errorf("objectKeys of an array: %v", keys)
	}
	if keys := objectKeys([]byte(`{"a":1,}`)); len(keys) != 1 || keys[0] != "a" {
		t.Errorf("objectKeys on a trailing comma: %v", keys)
	}
	if keys := objectKeys([]byte(`{"a":`)); len(keys) != 1 {
		t.Errorf("objectKeys on a cut value: %v", keys)
	}
	if HasOnlySafeKeys([]byte(`{"a":}`)) {
		t.Error("HasOnlySafeKeys accepted broken JSON")
	}
	deep := strings.Repeat("[", 66) + strings.Repeat("]", 66)
	if HasOnlySafeKeys([]byte(deep)) {
		t.Error("HasOnlySafeKeys accepted 66 levels")
	}
}

func TestParseUserRejectsOversizedIdentities(t *testing.T) {
	long := strings.Repeat("x", 129)
	for _, raw := range []string{
		`{"id":"","name":"a","color":"#000"}`,
		`{"id":"` + long + `","name":"a","color":"#000"}`,
		`{"id":"u","name":"` + long + `","color":"#000"}`,
		`{"id":"u","name":"a","color":"` + long + `"}`,
	} {
		if _, ok := ParseUser([]byte(raw)); ok {
			t.Errorf("accepted %s", raw)
		}
	}
}

func TestParsePatchRejectsEveryInvalidShape(t *testing.T) {
	for _, raw := range []string{
		`1`,
		`{"doc":1}`,
		`{"entities":1}`,
		`{"entities":{"components":{"c1":1}}}`,
		`{"entities":{"components":{"c1":{"set":{"":1}}}}}`,
		`{"entities":{"components":{"c1":{"unset":"x"}}}}`,
		`{"entities":{"components":{"c1":{"unset":[1]}}}}`,
	} {
		if _, ok := ParsePatch([]byte(raw)); ok {
			t.Errorf("accepted %s", raw)
		}
	}
}

func TestParseStateRejectsEveryInvalidShape(t *testing.T) {
	rest := `"connections":{},"flows":{},"iconLibrary":{},"nodeLayouts":{},"edgeLayouts":{},"versions":{}`
	entities := `{"components":{},` + rest + `}`
	valid := `{"doc":{},"entities":` + entities + `}`
	if _, ok := ParseState([]byte(valid)); !ok {
		t.Fatalf("rejected %s", valid)
	}
	for _, raw := range []string{
		`[]`,
		`{"doc":{"nope":1},"entities":` + entities + `}`,
		`{"doc":{},"entities":{"components":{}}}`,
		`{"doc":{},"entities":{"components":{"__proto__":{}},` + rest + `}}`,
		`{"doc":{},"entities":{"components":{"c1":1},` + rest + `}}`,
		`{"doc":{},"entities":{"components":{"c1":{"__proto__":1}},` + rest + `}}`,
	} {
		if _, ok := ParseState([]byte(raw)); ok {
			t.Errorf("accepted %s", raw)
		}
	}
}

func TestStateCreatedStartsAnOrderWhenThereIsNone(t *testing.T) {
	var s State
	s.Created("components", "c1")
	if ids := s.Order["components"]; len(ids) != 1 || ids[0] != "c1" {
		t.Errorf("order: %v", s.Order)
	}
}

func TestEntityPatchMarshalsSetAndUnsetTogether(t *testing.T) {
	p := &EntityPatch{Set: map[string]json.RawMessage{"x": json.RawMessage(`1`)}, Unset: []string{"a", "b"}}
	out, err := p.MarshalJSON()
	if err != nil || string(out) != `{"set":{"x":1},"unset":["a","b"]}` {
		t.Errorf("got %s, %v", out, err)
	}
}

func TestPatchUnmarshalJSONValidates(t *testing.T) {
	var p Patch
	if err := json.Unmarshal([]byte(`{"doc":{"diagramName":"x"}}`), &p); err != nil {
		t.Fatalf("valid patch: %v", err)
	}
	if string(p.Doc["diagramName"]) != `"x"` {
		t.Errorf("doc: %s", p.Doc["diagramName"])
	}
	if err := json.Unmarshal([]byte(`{"nope":1}`), &p); err == nil {
		t.Error("invalid patch accepted")
	}
}

func TestMarshalReportsValuesJSONCannotHold(t *testing.T) {
	if _, err := Marshal(make(chan int)); err == nil {
		t.Error("Marshal of a channel")
	}
	defer func() {
		if recover() == nil {
			t.Error("MustMarshal did not panic")
		}
	}()
	MustMarshal(make(chan int))
}

func TestStateOrderClonesAndEncoding(t *testing.T) {
	s := EmptyState()
	s.Doc["diagramName"] = json.RawMessage(`"D"`)
	for _, id := range []string{"b", "a", "c"} {
		s.Entities["components"][id] = Entity{"id": json.RawMessage(`"` + id + `"`)}
		s.Created("components", id)
	}
	s.Removed("components", "a")
	s.Removed("components", "zz")
	// "a" lost its place: it comes after the ordered ids. "y" and "x" never had one: sorted.
	s.Entities["components"]["y"] = Entity{}
	s.Entities["components"]["x"] = Entity{}
	if got := strings.Join(s.IDs("components"), ","); got != "b,c,a,x,y" {
		t.Errorf("ids %s", got)
	}

	c := s.Clone()
	c.Entities["components"]["b"]["id"] = json.RawMessage(`"changed"`)
	c.Doc["diagramName"] = json.RawMessage(`"E"`)
	c.Created("components", "new")
	if string(s.Entities["components"]["b"]["id"]) != `"b"` || string(s.Doc["diagramName"]) != `"D"` || len(s.Order["components"]) != 2 {
		t.Error("clone shares state with the original")
	}

	small := EmptyState()
	small.Doc["diagramName"] = json.RawMessage(`"D"`)
	small.Entities["components"]["c1"] = Entity{"x": json.RawMessage(`1`)}
	small.Entities["components"]["c2"] = Entity{}
	small.Created("components", "c1")
	small.Created("components", "c2")
	out, err := small.MarshalJSON()
	want := `{"doc":{"diagramName":"D"},"entities":{"components":{"c1":{"x":1},"c2":{}},"connections":{},"flows":{},"iconLibrary":{},"nodeLayouts":{},"edgeLayouts":{},"versions":{}}}`
	if err != nil || string(out) != want {
		t.Errorf("got %s, %v", out, err)
	}
}

func TestPatchTouchIsEmptyAndEncoding(t *testing.T) {
	var p Patch
	if !p.IsEmpty() {
		t.Error("zero patch not empty")
	}
	p.Entities = map[string]map[string]*EntityPatch{"components": {}}
	if !p.IsEmpty() {
		t.Error("patch with an empty collection not empty")
	}
	p.Touch("components", "c2", &EntityPatch{Delete: true})
	p.Touch("components", "c1", &EntityPatch{Set: map[string]json.RawMessage{"x": json.RawMessage(`1`)}})
	p.Touch("components", "c2", &EntityPatch{Unset: []string{"y"}})
	p.Touch("connections", "e1", &EntityPatch{Delete: true})
	if p.IsEmpty() {
		t.Error("patch with changes is empty")
	}
	if got := strings.Join(p.IDs("components"), ","); got != "c2,c1" {
		t.Errorf("touch order %s", got)
	}
	out, _ := p.MarshalJSON()
	want := `{"entities":{"components":{"c2":{"unset":["y"]},"c1":{"set":{"x":1}}},"connections":{"e1":null}}}`
	if string(out) != want {
		t.Errorf("got %s", out)
	}

	docOnly := Patch{Doc: map[string]json.RawMessage{"level": json.RawMessage(`"L1"`)}}
	if docOnly.IsEmpty() {
		t.Error("doc patch is empty")
	}
	docOnly.Touch("components", "c1", &EntityPatch{Delete: true})
	out, _ = docOnly.MarshalJSON()
	if string(out) != `{"doc":{"level":"L1"},"entities":{"components":{"c1":null}}}` {
		t.Errorf("got %s", out)
	}
}

func TestMessageHelpers(t *testing.T) {
	frame := ErrorFrame(ErrTooLarge, "big", IntPtr(10), IntPtr(11))
	if string(frame) != `{"type":"error","code":"too_large","message":"big","limit":10,"size":11}` {
		t.Errorf("error frame %s", frame)
	}
	if FormatVersion(42) != "000000000042" || FormatVersion(1234567890123) != "1234567890123" {
		t.Errorf("FormatVersion %s %s", FormatVersion(42), FormatVersion(1234567890123))
	}
}

func TestParseStateKeepsDocFieldsAndRejectsBrokenJSON(t *testing.T) {
	rest := `"connections":{},"flows":{},"iconLibrary":{},"nodeLayouts":{},"edgeLayouts":{},"versions":{}`
	s, ok := ParseState([]byte(`{"doc":{"diagramName": "D"},"entities":{"components":{},` + rest + `}}`))
	if !ok || string(s.Doc["diagramName"]) != `"D"` {
		t.Errorf("doc %v %v", s.Doc, ok)
	}
	if _, ok := ParseState([]byte(`{"doc":`)); ok {
		t.Error("accepted broken JSON")
	}
	if _, ok := ParseState([]byte(`{"entities":{}}`)); ok {
		t.Error("accepted a state without doc")
	}
}
