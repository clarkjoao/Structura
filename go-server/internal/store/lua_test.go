package store

import (
	"os"
	"path/filepath"
	"testing"
)

// The Lua scripts are the TypeScript relay's, so both relays can share a Redis. When the TS relay
// sits next to this module, hold the copies to it.
func TestLuaMatchesTheTypeScriptRelay(t *testing.T) {
	dir := filepath.Join("..", "..", "..", "server", "src", "collab", "store", "lua")
	if _, err := os.Stat(dir); err != nil {
		t.Skip("TypeScript relay not present")
	}
	for name, body := range LuaScripts() {
		want, err := os.ReadFile(filepath.Join(dir, name))
		if err != nil {
			t.Fatalf("%s: %v", name, err)
		}
		if string(want) != body {
			t.Errorf("%s differs from the TypeScript relay's copy", name)
		}
	}
}
