// Command relay is the long-lived collaboration relay: a WebSocket server for ECS, Kubernetes or a
// single host. Rooms live in memory (one instance) or in Redis when REDIS_URL is set (any number of
// instances behind a load balancer, no session affinity needed).
//
// Environment: PORT (3000), WS_PATH (/ws), REDIS_URL, REDIS_NAMESPACE, COLLAB_HOST_GRACE_MS,
// COLLAB_MAX_PARTICIPANTS, SSL_KEY_PATH + SSL_CERT_PATH (optional TLS).
package main

import (
	"context"
	"encoding/json"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"sync/atomic"
	"syscall"
	"time"

	"github.com/gorilla/websocket"

	"github.com/clarkjoao/structura/go-server/internal/protocol"
	"github.com/clarkjoao/structura/go-server/internal/relay"
	"github.com/clarkjoao/structura/go-server/internal/store"
	"github.com/clarkjoao/structura/go-server/internal/wsconn"
)

var (
	// heartbeat is how often a socket is pinged; one missed round drops it.
	heartbeat = 30 * time.Second
	// drainTimeout bounds the graceful shutdown.
	drainTimeout = 10 * time.Second
	// drainHook runs as the drain starts (tests hold it to reach the timeout).
	drainHook = func() {}
	exit      = os.Exit
)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGTERM, syscall.SIGINT)
	defer stop()
	exit(run(ctx, os.Getenv, log.Printf))
}

func envInt(getenv func(string) string, key string) int {
	n, _ := strconv.Atoi(strings.TrimSpace(getenv(key)))
	return n
}

func wsPath(getenv func(string) string) string {
	p := strings.TrimSpace(getenv("WS_PATH"))
	if p == "" {
		return "/ws"
	}
	if !strings.HasPrefix(p, "/") {
		return "/" + p
	}
	return p
}

// server is one relay process: its store, the relay and its sockets.
type server struct {
	rooms     store.Shared
	heartbeat time.Duration
	relay     *relay.Relay
	started   time.Time
	draining  atomic.Bool
	upgrader  websocket.Upgrader
}

func (s *server) health(w http.ResponseWriter, _ *http.Request) {
	ready := s.rooms.Available() && !s.draining.Load()
	status, code := "ok", http.StatusOK
	if !ready {
		status, code = "unavailable", http.StatusServiceUnavailable
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(map[string]any{
		"status": status,
		"uptime": time.Since(s.started).Seconds(),
		"ready":  ready,
		"collab": map[string]any{"store": s.rooms.Kind(), "relay": "go"},
	})
}

func (s *server) socket(w http.ResponseWriter, req *http.Request) {
	ws, err := s.upgrader.Upgrade(w, req, nil)
	if err != nil {
		return
	}
	// Frames are text; leave headroom over the character cap for multi-byte content.
	ws.SetReadLimit(protocol.MaxFrameChars * 4)
	conn := wsconn.New(ws)
	if s.draining.Load() {
		// Shutting down: send the client straight on to another relay.
		conn.Close(1012, "restarting")
		return
	}
	handlers := s.relay.Connect(conn)

	var alive atomic.Bool
	alive.Store(true)
	ws.SetPongHandler(func(string) error { alive.Store(true); return nil })
	stopBeat := make(chan struct{})
	go func() {
		// Transport-level liveness: a socket that misses a ping round is dropped, so its client
		// reconnects and its room membership expires instead of lingering.
		ticker := time.NewTicker(s.heartbeat)
		defer ticker.Stop()
		for {
			select {
			case <-stopBeat:
				return
			case <-ticker.C:
				if !alive.Swap(false) {
					conn.Terminate()
					return
				}
				_ = conn.Ping()
			}
		}
	}()

	for {
		kind, data, err := ws.ReadMessage()
		if err != nil {
			break
		}
		if kind != websocket.TextMessage {
			continue
		}
		handlers.OnMessage(data)
	}
	close(stopBeat)
	handlers.OnClose()
	conn.Terminate()
}

// run serves until ctx ends, then drains: it stops advertising the instance, hands open sockets
// back to their clients (they reconnect to another instance) and stops. It returns the exit code.
func run(ctx context.Context, getenv func(string) string, logf func(string, ...any)) int {
	port := strings.TrimSpace(getenv("PORT"))
	if port == "" {
		port = "3000"
	}
	path := wsPath(getenv)

	var rooms store.Shared
	if url := strings.TrimSpace(getenv("REDIS_URL")); url != "" {
		redisStore, err := store.NewRedis(url, store.RedisOptions{Namespace: strings.TrimSpace(getenv("REDIS_NAMESPACE"))})
		if err != nil {
			logf("[server] REDIS_URL: %v", err)
			return 1
		}
		rooms = redisStore
	} else {
		rooms = store.NewMemory(nil)
	}

	hook, timeout := drainHook, drainTimeout
	s := &server{
		rooms:     rooms,
		heartbeat: heartbeat,
		relay: relay.New(rooms, relay.Options{
			MaxParticipants: envInt(getenv, "COLLAB_MAX_PARTICIPANTS"),
			HostGrace:       time.Duration(envInt(getenv, "COLLAB_HOST_GRACE_MS")) * time.Millisecond,
		}),
		started: time.Now(),
		upgrader: websocket.Upgrader{
			ReadBufferSize:  32 * 1024,
			WriteBufferSize: 32 * 1024,
			// The link is the capability; any origin may connect, as with the TypeScript relay.
			CheckOrigin: func(*http.Request) bool { return true },
		},
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/health", s.health)
	mux.HandleFunc(path, s.socket)
	httpServer := &http.Server{Handler: mux, ReadHeaderTimeout: 10 * time.Second}

	listener, err := net.Listen("tcp", ":"+port)
	if err != nil {
		logf("[server] %v", err)
		s.relay.Stop()
		_ = rooms.Close()
		return 1
	}
	keyPath, certPath := getenv("SSL_KEY_PATH"), getenv("SSL_CERT_PATH")
	tls := keyPath != "" && certPath != ""
	proto, wsProto := "http", "ws"
	if tls {
		proto, wsProto = "https", "wss"
	}
	logf("[server] %s → %s://localhost:%s", strings.ToUpper(proto), proto, port)
	logf("[server] WS   → %s://localhost:%s%s", wsProto, port, path)
	if rooms.Kind() == "redis" {
		logf("[server] ROOMS → redis (shared)")
	} else {
		logf("[server] ROOMS → memory (single instance)")
	}
	served := make(chan error, 1)
	go func() {
		if tls {
			served <- httpServer.ServeTLS(listener, certPath, keyPath)
		} else {
			served <- httpServer.Serve(listener)
		}
	}()

	code := 0
	select {
	case <-ctx.Done():
		logf("[server] shutting down gracefully")
	case err := <-served:
		logf("[server] %v", err)
		code = 1
	}

	s.draining.Store(true)
	done := make(chan struct{})
	go func() {
		hook()
		s.relay.Stop()
		shutdown, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = httpServer.Shutdown(shutdown)
		_ = rooms.Close()
		close(done)
	}()
	select {
	case <-done:
		logf("[server] HTTP server closed")
		return code
	case <-time.After(timeout):
		logf("[server] Shutdown timeout — forcing exit")
		return 1
	}
}
