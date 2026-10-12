package main

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"fmt"
	"math/big"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"syscall"
	"testing"
	"time"

	"github.com/gorilla/websocket"

	"github.com/clarkjoao/structura/go-server/internal/relay"
	"github.com/clarkjoao/structura/go-server/internal/store"
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

func envOf(values map[string]string) func(string) string {
	return func(key string) string { return values[key] }
}

// start runs the relay until the returned stop is called; stop returns the exit code.
func start(t *testing.T, env map[string]string, client *http.Client, scheme string) (string, *logs, func() int) {
	t.Helper()
	l := &logs{}
	ctx, cancel := context.WithCancel(context.Background())
	code := make(chan int, 1)
	go func() { code <- run(ctx, envOf(env), l.logf) }()
	base := scheme + "://127.0.0.1:" + env["PORT"]
	deadline := time.Now().Add(5 * time.Second)
	for {
		res, err := client.Get(base + "/health")
		if err == nil {
			res.Body.Close()
			break
		}
		if time.Now().After(deadline) {
			t.Fatalf("relay did not start: %v\n%s", err, l)
		}
		time.Sleep(10 * time.Millisecond)
	}
	return base, l, func() int { cancel(); return <-code }
}

func TestRelayServesSocketsAndDrains(t *testing.T) {
	heartbeat = 30 * time.Millisecond
	defer func() { heartbeat = 30 * time.Second }()
	port := freePort(t)
	base, l, stop := start(t, map[string]string{"PORT": port, "WS_PATH": "sock", "COLLAB_MAX_PARTICIPANTS": "5"}, http.DefaultClient, "http")
	url := "ws" + strings.TrimPrefix(base, "http") + "/sock"

	ws, _, err := websocket.DefaultDialer.Dial(url, nil)
	if err != nil {
		t.Fatal(err)
	}
	defer ws.Close()
	_ = ws.WriteMessage(websocket.BinaryMessage, []byte("ignored"))
	_ = ws.WriteMessage(websocket.TextMessage, []byte(`{"type":"ping"}`))
	_, reply, err := ws.ReadMessage()
	if err != nil || string(reply) != `{"type":"pong"}` {
		t.Fatalf("reply %s %v", reply, err)
	}
	// Reading answers the server's pings: the socket stays through several heartbeats.
	go func() {
		for {
			if _, _, err := ws.ReadMessage(); err != nil {
				return
			}
		}
	}()

	// A socket that never answers a ping is dropped.
	silent, _, err := websocket.DefaultDialer.Dial(url, nil)
	if err != nil {
		t.Fatal(err)
	}
	defer silent.Close()
	silent.SetPingHandler(func(string) error { return nil })
	_ = silent.SetReadDeadline(time.Now().Add(3 * time.Second))
	if _, _, err := silent.ReadMessage(); err == nil {
		t.Error("the silent socket got a message")
	} else if ne, ok := err.(net.Error); ok && ne.Timeout() {
		t.Error("a socket that never answers pings was kept")
	}

	// Not an upgrade.
	res, err := http.Get(base + "/sock")
	if err != nil || res.StatusCode != http.StatusBadRequest {
		t.Errorf("plain GET on the socket path: %v %v", res, err)
	}
	if code := stop(); code != 0 {
		t.Errorf("exit %d\n%s", code, l)
	}
	if !strings.Contains(l.String(), "ROOMS → memory") || !strings.Contains(l.String(), "HTTP server closed") {
		t.Errorf("logs:\n%s", l)
	}
}

func TestRelaySendsNewSocketsAwayWhileDraining(t *testing.T) {
	rooms := store.NewMemory(nil)
	s := &server{rooms: rooms, heartbeat: time.Minute, relay: relay.New(rooms, relay.Options{DisableTimers: true}), started: time.Now()}
	defer s.relay.Stop()
	s.draining.Store(true)
	mux := http.NewServeMux()
	mux.HandleFunc("/ws", s.socket)
	mux.HandleFunc("/health", s.health)
	srv := httptest.NewServer(mux)
	defer srv.Close()
	ws, _, err := websocket.DefaultDialer.Dial("ws"+strings.TrimPrefix(srv.URL, "http")+"/ws", nil)
	if err != nil {
		t.Fatal(err)
	}
	defer ws.Close()
	_, _, err = ws.ReadMessage()
	if ce, ok := err.(*websocket.CloseError); !ok || ce.Code != 1012 {
		t.Errorf("close %v", err)
	}
	res, _ := http.Get(srv.URL + "/health")
	if res.StatusCode != http.StatusServiceUnavailable {
		t.Errorf("health while draining: %d", res.StatusCode)
	}
}

func TestRelayWithRedis(t *testing.T) {
	if code := run(context.Background(), envOf(map[string]string{"REDIS_URL": "not a url"}), (&logs{}).logf); code != 1 {
		t.Errorf("bad REDIS_URL: exit %d", code)
	}
	port := freePort(t)
	base, l, stop := start(t, map[string]string{"PORT": port, "REDIS_URL": "redis://127.0.0.1:1", "WS_PATH": "/collab"}, http.DefaultClient, "http")
	res, err := http.Get(base + "/health")
	if err != nil || res.StatusCode != http.StatusServiceUnavailable {
		t.Errorf("health with Redis down: %v %v", res, err)
	}
	stop()
	if !strings.Contains(l.String(), "ROOMS → redis") || !strings.Contains(l.String(), "/collab") {
		t.Errorf("logs:\n%s", l)
	}
}

func TestRelayStartupFailures(t *testing.T) {
	l := &logs{}
	if code := run(context.Background(), envOf(map[string]string{"PORT": "not-a-port"}), l.logf); code != 1 {
		t.Errorf("bad port: exit %d", code)
	}
	dir := t.TempDir()
	broken := filepath.Join(dir, "broken.pem")
	_ = os.WriteFile(broken, []byte("not a certificate"), 0o600)
	l = &logs{}
	code := run(context.Background(), envOf(map[string]string{"PORT": freePort(t), "SSL_KEY_PATH": broken, "SSL_CERT_PATH": broken}), l.logf)
	if code != 1 || !strings.Contains(l.String(), "HTTPS") {
		t.Errorf("broken certificate: exit %d\n%s", code, l)
	}
}

func TestRelayServesTLS(t *testing.T) {
	dir := t.TempDir()
	certPath, keyPath := writeCert(t, dir)
	client := &http.Client{Transport: &http.Transport{TLSClientConfig: &tls.Config{InsecureSkipVerify: true}}} //nolint:gosec // a test certificate
	_, l, stop := start(t, map[string]string{"PORT": freePort(t), "SSL_KEY_PATH": keyPath, "SSL_CERT_PATH": certPath}, client, "https")
	if code := stop(); code != 0 {
		t.Errorf("exit %d", code)
	}
	if !strings.Contains(l.String(), "wss://") {
		t.Errorf("logs:\n%s", l)
	}
}

func TestRelayForcesExitWhenTheDrainHangs(t *testing.T) {
	release := make(chan struct{})
	drainHook = func() { <-release }
	drainTimeout = 10 * time.Millisecond
	defer func() { drainHook = func() {}; drainTimeout = 10 * time.Second }()
	_, l, stop := start(t, map[string]string{"PORT": freePort(t)}, http.DefaultClient, "http")
	if code := stop(); code != 1 {
		t.Errorf("exit %d", code)
	}
	close(release)
	if !strings.Contains(l.String(), "forcing exit") {
		t.Errorf("logs:\n%s", l)
	}
}

func TestMainStopsOnSIGTERM(t *testing.T) {
	port := freePort(t)
	t.Setenv("PORT", port)
	codes := make(chan int, 1)
	exit = func(code int) { codes <- code }
	defer func() { exit = os.Exit }()
	go main()
	deadline := time.Now().Add(5 * time.Second)
	for {
		res, err := http.Get("http://127.0.0.1:" + port + "/health")
		if err == nil {
			res.Body.Close()
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("main did not start")
		}
		time.Sleep(10 * time.Millisecond)
	}
	_ = syscall.Kill(os.Getpid(), syscall.SIGTERM)
	select {
	case code := <-codes:
		if code != 0 {
			t.Errorf("exit %d", code)
		}
	case <-time.After(15 * time.Second):
		t.Fatal("main did not stop")
	}
}

func writeCert(t *testing.T, dir string) (string, string) {
	t.Helper()
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	tmpl := &x509.Certificate{
		SerialNumber: big.NewInt(1), Subject: pkix.Name{CommonName: "localhost"},
		NotBefore: time.Now().Add(-time.Hour), NotAfter: time.Now().Add(time.Hour),
		IPAddresses: []net.IP{net.ParseIP("127.0.0.1")},
	}
	der, err := x509.CreateCertificate(rand.Reader, tmpl, tmpl, &key.PublicKey, key)
	if err != nil {
		t.Fatal(err)
	}
	keyDER, _ := x509.MarshalECPrivateKey(key)
	certPath, keyPath := filepath.Join(dir, "cert.pem"), filepath.Join(dir, "key.pem")
	_ = os.WriteFile(certPath, pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der}), 0o600)
	_ = os.WriteFile(keyPath, pem.EncodeToMemory(&pem.Block{Type: "EC PRIVATE KEY", Bytes: keyDER}), 0o600)
	return certPath, keyPath
}
