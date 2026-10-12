// Command apigw-local runs the Lambda handler behind a local stand-in for an API Gateway
// WebSocket API, so the serverless mode can be exercised end to end on a laptop: browsers and the
// load harness connect to ws://localhost:3000/ws exactly as they would to the relay.
//
// What it reproduces from API Gateway, because the handler must cope with it:
//   - every inbound frame is a separate invocation, run concurrently (optionally with random
//     delay, INVOKE_JITTER_MS), so frames of one socket can be handled out of order;
//   - replies go through the real AWS SDK `@connections` client, served here
//     (POST/GET/DELETE /@connections/{id}), with 410 Gone for closed sockets;
//   - the 128 KB message limit both ways, the 10-minute idle timeout and the 2-hour cap
//     (IDLE_TIMEOUT_MS, MAX_CONNECTION_MS to shorten them, checked every SWEEP_INTERVAL_MS);
//   - $disconnect after either side closes;
//   - the reaper schedule (REAP_INTERVAL_MS, default 60 s).
//
// LAMBDA_URL (comma-separated) sends the events to Lambda Runtime Interface Emulators instead —
// the real cmd/lambda binary in the real Lambda base image (Dockerfile.lambda) — one invocation
// per emulator at a time, each socket's frames in order. INVOKE_ORDERED=1 does the same in process.
//
// Storage is configured like the Lambda (see serverless.ConfigFromEnv): DynamoDB by default
// (DYNAMODB_ENDPOINT=http://localhost:8000 for DynamoDB Local; the table is created), or Redis.
package main

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"log"
	mrand "math/rand/v2"
	"net"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"syscall"
	"time"

	"github.com/gorilla/websocket"

	"github.com/clarkjoao/structura/go-server/internal/serverless"
	"github.com/clarkjoao/structura/go-server/internal/wsconn"
)

const maxMessage = 128 * 1024

var (
	exit   = os.Exit
	listen = net.Listen
)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGTERM, syscall.SIGINT)
	defer stop()
	exit(run(ctx, log.Printf))
}

func envMs(key string, fallback time.Duration) time.Duration {
	if n, err := strconv.Atoi(strings.TrimSpace(os.Getenv(key))); err == nil && n > 0 {
		return time.Duration(n) * time.Millisecond
	}
	return fallback
}

type socket struct {
	conn        *wsconn.Conn
	connectedAt time.Time
	lastActive  atomic.Int64
}

// emulator is the stand-in API Gateway: it holds the sockets and runs the function per event.
type emulator struct {
	handler invoker
	ordered bool
	idle    time.Duration
	maxAge  time.Duration
	jitter  time.Duration
	// sweep is how often idle and over-age sockets are checked.
	sweep    time.Duration
	logf     func(string, ...any)
	upgrader websocket.Upgrader

	mu      sync.Mutex
	sockets map[string]*socket
}

func (e *emulator) get(id string) *socket {
	e.mu.Lock()
	defer e.mu.Unlock()
	return e.sockets[id]
}

func newConnectionID() string {
	var b [10]byte
	_, _ = rand.Read(b[:])
	// API Gateway ids look like "Pq3bdc9VoAMCJ1Q="; the URL-safe alphabet keeps them path-safe.
	return base64.URLEncoding.EncodeToString(b[:])
}

func awsError(w http.ResponseWriter, status int, kind, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("X-Amzn-Errortype", kind)
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]string{"__type": kind, "message": message})
}

func (e *emulator) invoke(name string, fn func(context.Context) error) {
	if e.jitter > 0 {
		time.Sleep(time.Duration(mrand.Int64N(int64(e.jitter))))
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	if err := fn(ctx); err != nil {
		e.logf("[apigw-local] %s: %v", name, err)
	}
}

func (e *emulator) socket(w http.ResponseWriter, r *http.Request) {
	ws, err := e.upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	ws.SetReadLimit(maxMessage)
	id := newConnectionID()
	s := &socket{conn: wsconn.New(ws), connectedAt: time.Now()}
	s.lastActive.Store(time.Now().UnixMilli())
	e.invoke("$connect", func(ctx context.Context) error { return e.handler.connect(ctx, id) })
	e.mu.Lock()
	e.sockets[id] = s
	e.mu.Unlock()

	stop := make(chan struct{})
	go func() {
		ticker := time.NewTicker(e.sweep)
		defer ticker.Stop()
		for {
			select {
			case <-stop:
				return
			case <-ticker.C:
				quiet := time.Since(time.UnixMilli(s.lastActive.Load()))
				if quiet > e.idle || time.Since(s.connectedAt) > e.maxAge {
					s.conn.Close(1001, "Going away")
					return
				}
			}
		}
	}()

	var inflight sync.WaitGroup
	// With ordered invocation, one worker per socket runs its frames in arrival order.
	var queue chan []byte
	if e.ordered {
		queue = make(chan []byte, 1024)
		go func() {
			for data := range queue {
				e.invoke("$default", func(ctx context.Context) error { return e.handler.message(ctx, id, data) })
				inflight.Done()
			}
		}()
	}
	for {
		kind, data, err := ws.ReadMessage()
		if err != nil {
			if errors.Is(err, websocket.ErrReadLimit) {
				s.conn.Close(1009, "Message too big")
			}
			break
		}
		s.lastActive.Store(time.Now().UnixMilli())
		if kind != websocket.TextMessage {
			continue
		}
		inflight.Add(1)
		if e.ordered {
			queue <- data
			continue
		}
		go func(data []byte) {
			defer inflight.Done()
			e.invoke("$default", func(ctx context.Context) error { return e.handler.message(ctx, id, data) })
		}(data)
	}
	if queue != nil {
		close(queue)
	}
	close(stop)
	e.mu.Lock()
	delete(e.sockets, id)
	e.mu.Unlock()
	s.conn.Terminate()
	// API Gateway reports $disconnect once the socket is gone, frames already received
	// may still be in flight.
	go func() {
		inflight.Wait()
		e.invoke("$disconnect", func(ctx context.Context) error { return e.handler.disconnect(ctx, id) })
	}()
}

// connections serves the management API (`@connections`) the function posts replies through.
func (e *emulator) connections(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/@connections/")
	s := e.get(id)
	if s == nil {
		awsError(w, http.StatusGone, "GoneException", "connection gone")
		return
	}
	switch r.Method {
	case http.MethodPost:
		body, _ := io.ReadAll(io.LimitReader(r.Body, maxMessage+1))
		if len(body) > maxMessage {
			awsError(w, http.StatusRequestEntityTooLarge, "PayloadTooLargeException", "payload too large")
			return
		}
		s.conn.Send(body)
		s.lastActive.Store(time.Now().UnixMilli())
		w.WriteHeader(http.StatusOK)
	case http.MethodDelete:
		s.conn.Close(1000, "")
		w.WriteHeader(http.StatusNoContent)
	case http.MethodGet:
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"connectedAt":  s.connectedAt.UTC().Format(time.RFC3339),
			"lastActiveAt": time.UnixMilli(s.lastActive.Load()).UTC().Format(time.RFC3339),
			"identity":     map[string]string{"sourceIp": "127.0.0.1", "userAgent": "apigw-local"},
		})
	default:
		w.WriteHeader(http.StatusMethodNotAllowed)
	}
}

// reapEvery runs the reaper on its schedule until ctx ends.
func (e *emulator) reapEvery(ctx context.Context, interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			e.invoke("reap", e.handler.reap)
		}
	}
}

// run serves until ctx ends; it returns the exit code.
func run(ctx context.Context, logf func(string, ...any)) int {
	port := strings.TrimSpace(os.Getenv("PORT"))
	if port == "" {
		port = "3000"
	}
	cfg := serverless.ConfigFromEnv()
	e := &emulator{
		ordered:  os.Getenv("INVOKE_ORDERED") == "1",
		idle:     envMs("IDLE_TIMEOUT_MS", 10*time.Minute),
		maxAge:   envMs("MAX_CONNECTION_MS", 2*time.Hour),
		jitter:   envMs("INVOKE_JITTER_MS", 0),
		sweep:    envMs("SWEEP_INTERVAL_MS", time.Second),
		logf:     logf,
		upgrader: websocket.Upgrader{CheckOrigin: func(*http.Request) bool { return true }},
		sockets:  map[string]*socket{},
	}
	if url := strings.TrimSpace(os.Getenv("LAMBDA_URL")); url != "" {
		// The function runs elsewhere (the Lambda base image with its runtime emulator); it
		// posts back through CALLBACK_URL, which must reach this process.
		e.handler = newOverHTTP(url)
		// Few emulator slots: run each socket's frames one at a time, in order, so a frame never
		// waits on one queued behind it.
		e.ordered = true
	} else {
		if cfg.RedisURL == "" {
			cfg.CreateTable = true
		}
		cfg.CallbackURL = "http://127.0.0.1:" + port
		h, err := serverless.Build(ctx, cfg, nil)
		if err != nil {
			logf("[apigw-local] %v", err)
			return 1
		}
		e.handler = inProcess{h}
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/health", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{"status": "ok", "ready": true, "collab": map[string]any{"relay": "go-lambda", "store": map[bool]string{true: "redis", false: "dynamodb"}[cfg.RedisURL != ""]}})
	})
	path := strings.TrimSpace(os.Getenv("WS_PATH"))
	if path == "" {
		path = "/ws"
	}
	mux.HandleFunc(path, e.socket)
	mux.HandleFunc("/@connections/", e.connections)

	listener, err := listen("tcp", ":"+port)
	if err != nil {
		logf("[apigw-local] %v", err)
		return 1
	}
	reapCtx, stopReaper := context.WithCancel(ctx)
	defer stopReaper()
	go e.reapEvery(reapCtx, envMs("REAP_INTERVAL_MS", time.Minute))

	logf("[apigw-local] WS   → ws://localhost:%s%s", port, path)
	if remote, ok := e.handler.(overHTTP); ok {
		logf("[apigw-local] FUNCTION → %d Lambda runtime emulator(s)", cap(remote.slots))
	} else {
		logf("[apigw-local] ROOMS → %s", map[bool]string{true: "redis", false: "dynamodb (" + cfg.Table + ")"}[cfg.RedisURL != ""])
	}
	server := &http.Server{Handler: mux, ReadHeaderTimeout: 10 * time.Second}
	served := make(chan error, 1)
	go func() { served <- server.Serve(listener) }()
	select {
	case <-ctx.Done():
		shutdown, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = server.Shutdown(shutdown)
		return 0
	case err := <-served:
		logf("[apigw-local] %v", err)
		return 1
	}
}
