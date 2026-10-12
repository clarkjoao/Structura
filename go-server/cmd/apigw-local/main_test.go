package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync"
	"syscall"
	"testing"
	"time"

	"github.com/gorilla/websocket"
)

type logs struct {
	mu    sync.Mutex
	lines []string
}

func (l *logs) logf(format string, args ...any) {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.lines = append(l.lines, fmt.Sprintf(format, args...))
}

func (l *logs) String() string {
	l.mu.Lock()
	defer l.mu.Unlock()
	return strings.Join(l.lines, "\n")
}

func freePort(t *testing.T) string {
	t.Helper()
	l, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer l.Close()
	return fmt.Sprint(l.Addr().(*net.TCPAddr).Port)
}

func waitHealthy(t *testing.T, port string) {
	t.Helper()
	deadline := time.Now().Add(10 * time.Second)
	for {
		res, err := http.Get("http://127.0.0.1:" + port + "/health")
		if err == nil {
			res.Body.Close()
			return
		}
		if time.Now().After(deadline) {
			t.Fatalf("not serving: %v", err)
		}
		time.Sleep(10 * time.Millisecond)
	}
}

// startRun runs the emulator with the environment already set; the returned stop gives its exit code.
func startRun(t *testing.T, port string) (*logs, func() int) {
	t.Helper()
	l := &logs{}
	ctx, cancel := context.WithCancel(context.Background())
	code := make(chan int, 1)
	go func() { code <- run(ctx, l.logf) }()
	waitHealthy(t, port)
	return l, func() int { cancel(); return <-code }
}

func closeCode(t *testing.T, ws *websocket.Conn) int {
	t.Helper()
	_ = ws.SetReadDeadline(time.Now().Add(5 * time.Second))
	for {
		_, _, err := ws.ReadMessage()
		if err == nil {
			continue
		}
		var ce *websocket.CloseError
		if errors.As(err, &ce) {
			return ce.Code
		}
		t.Fatalf("not closed with a code: %v", err)
	}
}

func TestEmulatorRunsTheHandlerInProcess(t *testing.T) {
	url := os.Getenv("REDIS_URL")
	if url == "" {
		t.Skip("REDIS_URL not set")
	}
	port := freePort(t)
	for k, v := range map[string]string{
		"PORT": port, "REDIS_URL": url, "REDIS_NAMESPACE": fmt.Sprintf("apigw-%d:", time.Now().UnixNano()),
		"IDLE_TIMEOUT_MS": "300", "SWEEP_INTERVAL_MS": "20", "REAP_INTERVAL_MS": "20", "INVOKE_JITTER_MS": "2",
	} {
		t.Setenv(k, v)
	}
	l, stop := startRun(t, port)
	ws, _, err := websocket.DefaultDialer.Dial("ws://127.0.0.1:"+port+"/ws", nil)
	if err != nil {
		t.Fatal(err)
	}
	defer ws.Close()
	_ = ws.WriteMessage(websocket.BinaryMessage, []byte{1})
	_ = ws.WriteMessage(websocket.TextMessage, []byte(`{"type":"ping"}`))
	_ = ws.SetReadDeadline(time.Now().Add(5 * time.Second))
	// The handler answers through @connections, as on AWS.
	if _, reply, err := ws.ReadMessage(); err != nil || string(reply) != `{"type":"pong"}` {
		t.Fatalf("reply %s %v", reply, err)
	}
	// Quiet past the idle timeout: API Gateway closes it.
	if code := closeCode(t, ws); code != 1001 {
		t.Errorf("idle close %d", code)
	}

	big, _, err := websocket.DefaultDialer.Dial("ws://127.0.0.1:"+port+"/ws", nil)
	if err != nil {
		t.Fatal(err)
	}
	defer big.Close()
	_ = big.WriteMessage(websocket.TextMessage, []byte(strings.Repeat("x", maxMessage+1)))
	if code := closeCode(t, big); code != 1009 {
		t.Errorf("too big close %d", code)
	}
	res, err := http.Get("http://127.0.0.1:" + port + "/ws")
	if err != nil || res.StatusCode != http.StatusBadRequest {
		t.Errorf("plain GET: %v %v", res, err)
	}
	if code := stop(); code != 0 {
		t.Errorf("exit %d", code)
	}
	if !strings.Contains(l.String(), "ROOMS → redis") {
		t.Errorf("logs:\n%s", l)
	}
}

// fakeRuntime stands in for the Lambda Runtime Interface Emulator: it records the events and
// fails the ones whose body says so.
func fakeRuntime(t *testing.T) (*httptest.Server, func() []string) {
	var mu sync.Mutex
	var seen []string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		raw, _ := io.ReadAll(r.Body)
		var event struct {
			RequestContext struct {
				RouteKey string `json:"routeKey"`
			} `json:"requestContext"`
			Body   string `json:"body"`
			Source string `json:"source"`
		}
		_ = json.Unmarshal(raw, &event)
		mu.Lock()
		seen = append(seen, event.RequestContext.RouteKey+event.Source+" "+event.Body)
		mu.Unlock()
		switch {
		case strings.Contains(event.Body, "status"):
			w.WriteHeader(http.StatusInternalServerError)
		case strings.Contains(event.Body, "fail"):
			_, _ = w.Write([]byte(`{"errorMessage":"boom"}`))
		default:
			_, _ = w.Write([]byte(`null`))
		}
	}))
	t.Cleanup(srv.Close)
	return srv, func() []string {
		mu.Lock()
		defer mu.Unlock()
		return append([]string(nil), seen...)
	}
}

func TestEmulatorSendsEventsToTheLambdaRuntime(t *testing.T) {
	runtime, seen := fakeRuntime(t)
	port := freePort(t)
	t.Setenv("PORT", port)
	t.Setenv("LAMBDA_URL", runtime.URL+", "+runtime.URL)
	t.Setenv("REAP_INTERVAL_MS", "20")
	t.Setenv("WS_PATH", "/socket")
	l, stop := startRun(t, port)
	ws, _, err := websocket.DefaultDialer.Dial("ws://127.0.0.1:"+port+"/socket", nil)
	if err != nil {
		t.Fatal(err)
	}
	for _, body := range []string{"one", "fail", "status", "two"} {
		_ = ws.WriteMessage(websocket.TextMessage, []byte(body))
	}
	ws.Close()
	deadline := time.Now().Add(5 * time.Second)
	for all := strings.Join(seen(), "|"); !strings.Contains(all, "$disconnect") || !strings.Contains(all, "aws.events"); all = strings.Join(seen(), "|") {
		if time.Now().After(deadline) {
			t.Fatalf("events %v", seen())
		}
		time.Sleep(10 * time.Millisecond)
	}
	var order []string
	for _, e := range seen() {
		if strings.HasPrefix(e, "$default ") {
			order = append(order, strings.TrimPrefix(e, "$default "))
		}
	}
	if strings.Join(order, ",") != "one,fail,status,two" {
		t.Errorf("frames out of order: %v", order)
	}
	if !strings.Contains(strings.Join(seen(), "|"), "aws.events") {
		t.Errorf("no reap: %v", seen())
	}
	stop()
	if !strings.Contains(l.String(), "2 Lambda runtime emulator(s)") || !strings.Contains(l.String(), "boom") || !strings.Contains(l.String(), "500") {
		t.Errorf("logs:\n%s", l)
	}
}

func TestEmulatorInProcessOrdered(t *testing.T) {
	inv := &recorder{}
	e := newTestEmulator(inv)
	e.ordered = true
	srv := httptest.NewServer(http.HandlerFunc(e.socket))
	defer srv.Close()
	ws, _, err := websocket.DefaultDialer.Dial("ws"+strings.TrimPrefix(srv.URL, "http"), nil)
	if err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 5; i++ {
		_ = ws.WriteMessage(websocket.TextMessage, []byte(fmt.Sprint(i)))
	}
	ws.Close()
	inv.waitFor(t, "disconnect")
	if got := inv.messages(); got != "0,1,2,3,4" {
		t.Errorf("order %s", got)
	}
}

func TestEmulatorConnectionsAPI(t *testing.T) {
	e := newTestEmulator(&recorder{})
	e.maxAge = 50 * time.Millisecond
	e.sweep = 10 * time.Millisecond
	mux := http.NewServeMux()
	mux.HandleFunc("/ws", e.socket)
	mux.HandleFunc("/@connections/", e.connections)
	srv := httptest.NewServer(mux)
	defer srv.Close()
	ws, _, err := websocket.DefaultDialer.Dial("ws"+strings.TrimPrefix(srv.URL, "http")+"/ws", nil)
	if err != nil {
		t.Fatal(err)
	}
	defer ws.Close()
	var id string
	deadline := time.Now().Add(5 * time.Second)
	for id == "" {
		e.mu.Lock()
		for k := range e.sockets {
			id = k
		}
		e.mu.Unlock()
		if time.Now().After(deadline) {
			t.Fatal("no socket")
		}
	}
	do := func(method, body string) int {
		req, _ := http.NewRequest(method, srv.URL+"/@connections/"+id, strings.NewReader(body))
		res, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		res.Body.Close()
		return res.StatusCode
	}
	if code := do(http.MethodGet, ""); code != http.StatusOK {
		t.Errorf("GET %d", code)
	}
	if code := do(http.MethodPost, `{"type":"pong"}`); code != http.StatusOK {
		t.Errorf("POST %d", code)
	}
	if _, msg, err := ws.ReadMessage(); err != nil || string(msg) != `{"type":"pong"}` {
		t.Errorf("delivered %s %v", msg, err)
	}
	if code := do(http.MethodPost, strings.Repeat("x", maxMessage+1)); code != http.StatusRequestEntityTooLarge {
		t.Errorf("POST too large %d", code)
	}
	if code := do(http.MethodPut, ""); code != http.StatusMethodNotAllowed {
		t.Errorf("PUT %d", code)
	}
	if code := do(http.MethodDelete, ""); code != http.StatusNoContent {
		t.Errorf("DELETE %d", code)
	}
	id = "unknown"
	if code := do(http.MethodGet, ""); code != http.StatusGone {
		t.Errorf("unknown %d", code)
	}

	// Past the maximum connection age.
	aged, _, err := websocket.DefaultDialer.Dial("ws"+strings.TrimPrefix(srv.URL, "http")+"/ws", nil)
	if err != nil {
		t.Fatal(err)
	}
	defer aged.Close()
	go func() {
		for i := 0; i < 20; i++ {
			_ = aged.WriteMessage(websocket.TextMessage, []byte("keepalive"))
			time.Sleep(10 * time.Millisecond)
		}
	}()
	if code := closeCode(t, aged); code != 1001 {
		t.Errorf("over-age close %d", code)
	}
}

func TestRunFailures(t *testing.T) {
	t.Setenv("REDIS_URL", "not a url")
	if code := run(context.Background(), (&logs{}).logf); code != 1 {
		t.Errorf("bad store: exit %d", code)
	}
	// DynamoDB by default, its table created: here it cannot be reached.
	t.Setenv("REDIS_URL", "")
	t.Setenv("DYNAMODB_ENDPOINT", "http://127.0.0.1:1")
	cancelled, cancel := context.WithCancel(context.Background())
	cancel()
	l := &logs{}
	if code := run(cancelled, l.logf); code != 1 || !strings.Contains(l.String(), "create table") {
		t.Errorf("DynamoDB unreachable: exit %d\n%s", code, l)
	}
	runtime, _ := fakeRuntime(t)
	t.Setenv("LAMBDA_URL", runtime.URL)
	t.Setenv("PORT", "not-a-port")
	if code := run(context.Background(), (&logs{}).logf); code != 1 {
		t.Errorf("bad port: exit %d", code)
	}
	t.Setenv("PORT", freePort(t))
	listen = func(string, string) (net.Listener, error) { return brokenListener{}, nil }
	defer func() { listen = net.Listen }()
	l = &logs{}
	if code := run(context.Background(), l.logf); code != 1 || !strings.Contains(l.String(), "accept failed") {
		t.Errorf("serve failure: exit %d\n%s", code, l)
	}
}

type brokenListener struct{}

func (brokenListener) Accept() (net.Conn, error) { return nil, errors.New("accept failed") }
func (brokenListener) Close() error              { return nil }
func (brokenListener) Addr() net.Addr            { return &net.TCPAddr{} }

func TestMainStopsOnSIGTERM(t *testing.T) {
	runtime, _ := fakeRuntime(t)
	port := freePort(t)
	t.Setenv("PORT", port)
	t.Setenv("LAMBDA_URL", runtime.URL)
	codes := make(chan int, 1)
	exit = func(code int) { codes <- code }
	defer func() { exit = os.Exit }()
	go main()
	waitHealthy(t, port)
	_ = syscall.Kill(os.Getpid(), syscall.SIGTERM)
	select {
	case code := <-codes:
		if code != 0 {
			t.Errorf("exit %d", code)
		}
	case <-time.After(10 * time.Second):
		t.Fatal("main did not stop")
	}
}

func TestOverHTTPReportsFailures(t *testing.T) {
	ctx := context.Background()
	if err := newOverHTTP("http://127.0.0.1:1").connect(ctx, "c"); err == nil {
		t.Error("connection refused unreported")
	}
	if err := newOverHTTP("http://bad\x7f").disconnect(ctx, "c"); err == nil {
		t.Error("bad URL unreported")
	}
}

// ── An invoker that records ────────────────────────────────────────────────

type recorder struct {
	mu     sync.Mutex
	events []string
}

func (r *recorder) add(e string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.events = append(r.events, e)
}
func (r *recorder) connect(context.Context, string) error    { r.add("connect"); return nil }
func (r *recorder) disconnect(context.Context, string) error { r.add("disconnect"); return nil }
func (r *recorder) reap(context.Context) error               { r.add("reap"); return nil }
func (r *recorder) message(_ context.Context, _ string, body []byte) error {
	r.add("message " + string(body))
	return nil
}

func (r *recorder) messages() string {
	r.mu.Lock()
	defer r.mu.Unlock()
	var out []string
	for _, e := range r.events {
		if strings.HasPrefix(e, "message ") {
			out = append(out, strings.TrimPrefix(e, "message "))
		}
	}
	return strings.Join(out, ",")
}

func (r *recorder) waitFor(t *testing.T, event string) {
	t.Helper()
	deadline := time.Now().Add(5 * time.Second)
	for {
		r.mu.Lock()
		found := false
		for _, e := range r.events {
			found = found || e == event
		}
		r.mu.Unlock()
		if found {
			return
		}
		if time.Now().After(deadline) {
			t.Fatalf("no %s", event)
		}
		time.Sleep(5 * time.Millisecond)
	}
}

func newTestEmulator(inv invoker) *emulator {
	return &emulator{
		handler: inv, idle: time.Minute, maxAge: time.Hour, sweep: time.Second,
		logf:     func(string, ...any) {},
		upgrader: websocket.Upgrader{CheckOrigin: func(*http.Request) bool { return true }},
		sockets:  map[string]*socket{},
	}
}
