package protocol

import (
	"strings"
	"testing"
)

const user = `{"id":"u1","name":"Ana","color":"#123456"}`

func TestParseClientMessageAcceptsEveryType(t *testing.T) {
	valid := []string{
		`{"type":"create","protocol":3,"roomId":"r1","user":` + user + `,"seedChars":10,"seedChunks":1}`,
		`{"type":"create","protocol":3,"roomId":"r1","user":` + user + `,"seedChars":10,"seedChunks":1,"hostToken":"t"}`,
		`{"type":"seed:chunk","index":0,"data":"{}"}`,
		`{"type":"seed:commit"}`,
		`{"type":"join","protocol":3,"roomId":"r1","user":` + user + `}`,
		`{"type":"join","protocol":3,"roomId":"r1","user":` + user + `,"hostToken":"t","resumeFrom":4}`,
		`{"type":"patch","opId":"o1","baseVersion":0,"patch":{"doc":{"diagramName":"x"}}}`,
		`{"type":"lock","action":"acquire","entityId":"n1"}`,
		`{"type":"lock","action":"renew","entityIds":["n1","n2","n1"]}`,
		`{"type":"cursor","cursor":{"x":1,"y":2},"activeElementId":null}`,
		`{"type":"cursor","cursor":null,"activeElementId":"n1"}`,
		`{"type":"close"}`,
		`{"type":"ping"}`,
		`{"type":"pong"}`,
	}
	for _, raw := range valid {
		if _, ok := ParseClientMessage([]byte(raw)); !ok {
			t.Errorf("rejected %s", raw)
		}
	}
	m, _ := ParseClientMessage([]byte(`{"type":"lock","action":"renew","entityIds":["n1","n2","n1"]}`))
	if len(m.EntityIDs) != 2 {
		t.Errorf("repeats kept: %v", m.EntityIDs)
	}
}

func TestParseClientMessageRejectsMalformedFrames(t *testing.T) {
	invalid := []string{
		"not json",
		"[]",
		`{"type":"unknown"}`,
		`{"type":"join","protocol":3,"roomId":"r1"}`,
		`{"type":"join","protocol":3,"roomId":"r1","user":{"id":"u"}}`,
		`{"type":"join","protocol":3,"roomId":"r1","user":` + user + `,"resumeFrom":-1}`,
		`{"type":"join","protocol":3,"roomId":"r1","user":` + user + `,"hostToken":null}`,
		`{"type":"join","protocol":3,"roomId":"__proto__","user":` + user + `}`,
		`{"type":"join","protocol":3,"roomId":"a}b","user":` + user + `}`,
		`{"type":"join","protocol":"3","roomId":"r1","user":` + user + `}`,
		`{"type":"patch","opId":"","baseVersion":0,"patch":{}}`,
		`{"type":"patch","opId":"o","baseVersion":1.5,"patch":{}}`,
		`{"type":"patch","opId":"o","baseVersion":0,"patch":{"nodes":{}}}`,
		`{"type":"lock","action":"steal","entityId":"n1"}`,
		`{"type":"lock","action":"acquire","entityId":"n1","entityIds":["n2"]}`,
		`{"type":"lock","action":"acquire","entityIds":[]}`,
		`{"type":"cursor","activeElementId":null}`,
		`{"type":"cursor","cursor":{"x":1,"y":2}}`,
		`{"type":"cursor","cursor":{"x":"1","y":2},"activeElementId":null}`,
		`{"type":"seed:chunk","index":"0","data":""}`,
	}
	for _, raw := range invalid {
		if _, ok := ParseClientMessage([]byte(raw)); ok {
			t.Errorf("accepted %s", raw)
		}
	}
	ids := make([]string, MaxLockBatch+1)
	for i := range ids {
		ids[i] = `"n` + strings.Repeat("x", i%5) + `"`
	}
	big := `{"type":"lock","action":"acquire","entityIds":[` + strings.Join(ids, ",") + `]}`
	if _, ok := ParseClientMessage([]byte(big)); ok {
		t.Error("accepted an oversized lock batch")
	}
}

func TestParseClientMessageRejectsPrototypePollution(t *testing.T) {
	polluting := []string{
		`{"type":"patch","opId":"o","baseVersion":0,"patch":{"entities":{"components":{"__proto__":{"set":{}}}}}}`,
		`{"type":"patch","opId":"o","baseVersion":0,"patch":{"entities":{"components":{"c1":{"set":{"constructor":1}}}}}}`,
		`{"type":"patch","opId":"o","baseVersion":0,"patch":{"entities":{"components":{"c1":{"set":{"meta":{"__proto__":{"x":1}}}}}}}}`,
		`{"type":"patch","opId":"o","baseVersion":0,"patch":{"entities":{"components":{"c1":{"unset":["prototype"]}}}}}`,
		`{"type":"patch","opId":"o","baseVersion":0,"patch":{"entities":{"components":{"c1":{"set":{"a":[{"b":{"prototype":1}}]}}}}}}`,
	}
	for _, raw := range polluting {
		if _, ok := ParseClientMessage([]byte(raw)); ok {
			t.Errorf("accepted %s", raw)
		}
	}
}

func TestParsePatch(t *testing.T) {
	if _, ok := ParsePatch([]byte(`{"doc":{"diagramName":"x","activeVersionId":null},"entities":{"components":{"c1":{"set":{"name":"A"}},"c2":null,"c3":{"unset":["x"]}}}}`)); !ok {
		t.Error("rejected a valid patch")
	}
	for _, raw := range []string{
		`{"entities":{"nodes":{}}}`,
		`{"doc":{"viewport":{}}}`,
		`{"entities":{"components":{"c1":{"merge":{}}}}}`,
		`{"entities":{"components":{"c1":{"unset":[1]}}}}`,
		`{"entities":{"components":{"c1":{"set":null}}}}`,
	} {
		if _, ok := ParsePatch([]byte(raw)); ok {
			t.Errorf("accepted %s", raw)
		}
	}
}

func TestParseStateRequiresEveryCollection(t *testing.T) {
	full := `{"doc":{},"entities":{"components":{},"connections":{},"flows":{},"iconLibrary":{},"nodeLayouts":{},"edgeLayouts":{},"versions":{}}}`
	if _, ok := ParseState([]byte(full)); !ok {
		t.Error("rejected a full state")
	}
	missing := strings.Replace(full, `,"versions":{}`, "", 1)
	if _, ok := ParseState([]byte(missing)); ok {
		t.Error("accepted a state without versions")
	}
}

func TestMarshalKeepsValuesAsSent(t *testing.T) {
	patch, _ := ParsePatch([]byte(`{"entities":{"iconLibrary":{"i":{"set":{"svg":"<svg a=\"1\"/>","n":1.5e3}}}}}`))
	got := string(MustMarshal(patch))
	want := `{"entities":{"iconLibrary":{"i":{"set":{"n":1.5e3,"svg":"<svg a=\"1\"/>"}}}}}`
	if got != want {
		t.Errorf("got %s want %s", got, want)
	}
	removal := string(MustMarshal(Patch{Entities: map[string]map[string]*EntityPatch{"components": {"c": {Delete: true}}}}))
	if removal != `{"entities":{"components":{"c":null}}}` {
		t.Errorf("removal %s", removal)
	}
}

func TestUTF16(t *testing.T) {
	if n := UTF16Len("a🚀é"); n != 4 {
		t.Errorf("UTF16Len %d", n)
	}
	units, ok := DecodeJSONStringUTF16([]byte(`"a\ud83d"`))
	if !ok || len(units) != 2 || units[1] != 0xd83d {
		t.Fatalf("lone surrogate lost: %v %v", units, ok)
	}
	rest, _ := DecodeJSONStringUTF16([]byte(`"\ude80b"`))
	if got := UTF16ToString(append(units, rest...)); got != "a🚀b" {
		t.Errorf("joined %q", got)
	}
	chunks := ChunkString("ab🚀cd", 3)
	if strings.Join(chunks, "") != "ab🚀cd" {
		t.Fatalf("chunks %q", chunks)
	}
	for _, c := range chunks {
		if UTF16Len(c) > 3 {
			t.Errorf("chunk %q over size", c)
		}
	}
	if got := ChunkString("", 3); len(got) != 1 || got[0] != "" {
		t.Errorf("empty %q", got)
	}
}

func TestFrameCharsCountLikeJavaScript(t *testing.T) {
	m, ok := ParseClientMessage([]byte(`{"type":"seed:chunk","index":0,"data":"🚀\ud83d"}`))
	if !ok || m.DataUnits != 3 {
		t.Fatalf("units %d %v", m.DataUnits, ok)
	}
}
