package merge

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/clarkjoao/structura/go-server/internal/protocol"
)

func TestApplyEffectiveReplaysDocFieldsAndRemovals(t *testing.T) {
	state := protocol.EmptyState()
	state.Entities["components"]["n1"] = protocol.Entity{"x": json.RawMessage(`1`), "y": json.RawMessage(`2`)}
	state.Created("components", "n1")

	var patch protocol.Patch
	patch.Doc = map[string]json.RawMessage{"diagramName": json.RawMessage(`"renamed"`)}
	patch.Touch("components", "n1", &protocol.EntityPatch{Unset: []string{"y"}})
	ApplyEffective(&state, patch)

	if string(state.Doc["diagramName"]) != `"renamed"` {
		t.Errorf("doc field not applied: %s", state.Doc["diagramName"])
	}
	if _, still := state.Entities["components"]["n1"]["y"]; still {
		t.Errorf("unset field kept: %v", state.Entities["components"]["n1"])
	}
	if string(state.Entities["components"]["n1"]["x"]) != `1` {
		t.Errorf("untouched field lost: %v", state.Entities["components"]["n1"])
	}
}

func TestApplyEffectiveCreatesSetsAndRemovesEntities(t *testing.T) {
	state := protocol.EmptyState()
	state.Entities["components"]["old"] = protocol.Entity{}
	state.Created("components", "old")

	var patch protocol.Patch
	patch.Touch("components", "new", &protocol.EntityPatch{Set: map[string]json.RawMessage{"name": json.RawMessage(`"A"`)}})
	patch.Touch("components", "old", &protocol.EntityPatch{Delete: true})
	patch.Touch("components", "missing", nil)
	ApplyEffective(&state, patch)

	if got := state.IDs("components"); len(got) != 1 || got[0] != "new" {
		t.Fatalf("ids %v", got)
	}
	if string(state.Entities["components"]["new"]["name"]) != `"A"` {
		t.Errorf("set not applied: %v", state.Entities["components"]["new"])
	}
}

func TestApplyIgnoresAFieldRemovalOnAMissingEntity(t *testing.T) {
	target := &Target{State: protocol.EmptyState(), Tombstones: map[string]int64{}}
	var patch protocol.Patch
	patch.Touch("components", "ghost", &protocol.EntityPatch{Unset: []string{"x"}})
	got := Apply(target, patch, 1, Context{LockHolder: func(string) string { return "" }})
	if !got.IsEmpty() {
		t.Errorf("removal created something: %+v", got)
	}
	if _, created := target.State.Entities["components"]["ghost"]; created {
		t.Error("entity created by a field removal")
	}
}

type fixture struct {
	Name  string          `json:"name"`
	Seed  json.RawMessage `json:"seed"`
	Locks []struct {
		EntityID string `json:"entityId"`
		Holder   string `json:"holder"`
	} `json:"locks"`
	Steps []struct {
		Sender        string          `json:"sender"`
		SenderVersion *int64          `json:"senderVersion"`
		Patch         json.RawMessage `json:"patch"`
		Expect        string          `json:"expect"`
		Effective     json.RawMessage `json:"effective"`
	} `json:"steps"`
	FinalVersion int64           `json:"finalVersion"`
	FinalState   json.RawMessage `json:"finalState"`
}

// unordered encodes a state with every collection in id order.
func unordered(state protocol.State) string {
	state.Order = nil
	return string(protocol.MustMarshal(state))
}

// The fixtures exported from the TypeScript suite, run against Apply directly (the store
// contract runs them again through every store).
func TestApplyMatchesTheTypeScriptFixtures(t *testing.T) {
	raw, err := os.ReadFile(filepath.Join("testdata", "merge.fixtures.json"))
	if err != nil {
		t.Fatal(err)
	}
	var fixtures []fixture
	if err := json.Unmarshal(raw, &fixtures); err != nil {
		t.Fatal(err)
	}
	for _, fx := range fixtures {
		t.Run(fx.Name, func(t *testing.T) {
			seed, ok := protocol.ParseState(fx.Seed)
			if !ok {
				t.Fatal("invalid seed")
			}
			locks := map[string]string{}
			for _, l := range fx.Locks {
				locks[l.EntityID] = l.Holder
			}
			target := &Target{State: seed, Tombstones: map[string]int64{}}
			var version int64
			for i, step := range fx.Steps {
				patch, ok := protocol.ParsePatch(step.Patch)
				if !ok {
					t.Fatalf("step %d: invalid patch", i)
				}
				sv := version
				if step.SenderVersion != nil {
					sv = *step.SenderVersion
				}
				effective := Apply(target, patch, version+1, Context{
					SenderVersion: sv,
					SenderID:      step.Sender,
					LockHolder:    func(id string) string { return locks[id] },
				})
				status := "noop"
				if !effective.IsEmpty() {
					status = "applied"
					version++
				}
				if status != step.Expect {
					t.Fatalf("step %d: %s, want %s", i, status, step.Expect)
				}
				if status == "applied" && step.Effective != nil {
					want, _ := protocol.ParsePatch(step.Effective)
					if got, w := string(protocol.MustMarshal(effective)), string(protocol.MustMarshal(want)); got != w {
						t.Fatalf("step %d effective\n got %s\nwant %s", i, got, w)
					}
				}
			}
			if version != fx.FinalVersion {
				t.Fatalf("version %d, want %d", version, fx.FinalVersion)
			}
			want, _ := protocol.ParseState(fx.FinalState)
			if got, w := unordered(target.State), unordered(want); got != w {
				t.Fatalf("state\n got %s\nwant %s", got, w)
			}
		})
	}
}
