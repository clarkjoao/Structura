package session

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/clarkjoao/structura/go-server/internal/protocol"
	"github.com/clarkjoao/structura/go-server/internal/store"
)

func TestHostTokens(t *testing.T) {
	a, b := NewHostToken(), NewHostToken()
	if a == b || len(a) != 43 {
		t.Fatalf("tokens %q %q", a, b)
	}
	hash := HashToken(a)
	if !TokenMatches(a, hash) {
		t.Error("own token refused")
	}
	if TokenMatches(b, hash) || TokenMatches(a, "") {
		t.Error("another token accepted")
	}
}

func TestCheckCreate(t *testing.T) {
	if n := ExpectedSeedChunks(0); n != 1 {
		t.Errorf("empty seed: %d chunks", n)
	}
	if n := ExpectedSeedChunks(protocol.ChunkChars + 1); n != 2 {
		t.Errorf("chunk+1: %d chunks", n)
	}
	ok := &protocol.ClientMessage{SeedChars: 10, SeedChunks: 1}
	if frame := CheckCreate(ok); frame != nil {
		t.Errorf("refused: %s", frame)
	}
	tooLarge := &protocol.ClientMessage{SeedChars: protocol.MaxSeedChars + 1, SeedChunks: 1}
	if frame := CheckCreate(tooLarge); !strings.Contains(string(frame), protocol.ErrTooLarge) {
		t.Errorf("too large: %s", frame)
	}
	wrongCount := &protocol.ClientMessage{SeedChars: 10, SeedChunks: 2}
	if frame := CheckCreate(wrongCount); !strings.Contains(string(frame), protocol.ErrInvalidSeed) {
		t.Errorf("wrong count: %s", frame)
	}
}

func TestSnapshotFramesReassembleTheState(t *testing.T) {
	state := protocol.EmptyState()
	state.Doc["diagramName"] = json.RawMessage(`"😀 long enough to split"`)
	frames := SnapshotFrames(&store.Snapshot{Version: 7, State: state}, 16)
	if len(frames) < 3 {
		t.Fatalf("%d frames", len(frames))
	}
	var text strings.Builder
	for i, frame := range frames[:len(frames)-1] {
		var chunk protocol.SnapshotChunk
		if err := json.Unmarshal(frame, &chunk); err != nil || chunk.Index != i || chunk.Total != len(frames)-1 {
			t.Fatalf("chunk %d: %s %v", i, frame, err)
		}
		text.WriteString(chunk.Data)
	}
	if text.String() != string(protocol.MustMarshal(state)) {
		t.Errorf("reassembled %s", text.String())
	}
	if end := string(frames[len(frames)-1]); end != `{"type":"snapshot:end","version":7}` {
		t.Errorf("end %s", end)
	}
}

func TestProtocolMismatch(t *testing.T) {
	if frame := string(ProtocolMismatch()); !strings.Contains(frame, protocol.ErrProtocolMismatch) {
		t.Errorf("frame %s", frame)
	}
}
