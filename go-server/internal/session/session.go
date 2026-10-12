// Package session holds the pieces of the session handlers that do not depend on how sockets
// are held: credentials, seed checks and snapshot framing. The long-lived relay and the
// serverless handlers both use them.
package session

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"

	"github.com/clarkjoao/structura/go-server/internal/protocol"
	"github.com/clarkjoao/structura/go-server/internal/store"
)

// HashToken is how a host credential is stored.
func HashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

// TokenMatches compares a presented credential with a stored hash in constant time.
func TokenMatches(token, expectedHash string) bool {
	actual := HashToken(token)
	return subtle.ConstantTimeCompare([]byte(actual), []byte(expectedHash)) == 1
}

// NewHostToken mints a host credential.
func NewHostToken() string {
	var b [32]byte
	_, _ = rand.Read(b[:])
	return base64.RawURLEncoding.EncodeToString(b[:])
}

// ExpectedSeedChunks is how many chunks a seed of seedChars must arrive in.
func ExpectedSeedChunks(seedChars int) int {
	n := (seedChars + protocol.ChunkChars - 1) / protocol.ChunkChars
	return max(1, n)
}

// CheckCreate validates a create message against the limits. It returns the error frame to send,
// or nil when the create may proceed.
func CheckCreate(m *protocol.ClientMessage) []byte {
	if m.SeedChars > protocol.MaxSeedChars {
		return protocol.ErrorFrame(protocol.ErrTooLarge, "Diagram too large for a live session",
			protocol.IntPtr(protocol.MaxSeedChars), protocol.IntPtr(m.SeedChars))
	}
	if m.SeedChunks != ExpectedSeedChunks(m.SeedChars) {
		return protocol.ErrorFrame(protocol.ErrInvalidSeed, "Chunk count does not match the seed size", nil, nil)
	}
	return nil
}

// SnapshotFrames encodes a snapshot as `snapshot:chunk` frames followed by `snapshot:end`, in
// chunks of at most chunkChars UTF-16 units.
func SnapshotFrames(snapshot *store.Snapshot, chunkChars int) [][]byte {
	text := string(protocol.MustMarshal(snapshot.State))
	chunks := protocol.ChunkString(text, chunkChars)
	frames := make([][]byte, 0, len(chunks)+1)
	for i, data := range chunks {
		frames = append(frames, protocol.MustMarshal(protocol.SnapshotChunk{
			Type: "snapshot:chunk", Index: i, Total: len(chunks), Data: data,
		}))
	}
	return append(frames, protocol.MustMarshal(protocol.SnapshotEnd{Type: "snapshot:end", Version: snapshot.Version}))
}

// ProtocolMismatch is the refusal for any other protocol version.
func ProtocolMismatch() []byte {
	return protocol.ErrorFrame(protocol.ErrProtocolMismatch, "This server speaks protocol 3", nil, nil)
}
