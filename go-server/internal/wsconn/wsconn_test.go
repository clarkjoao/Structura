package wsconn

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
)

// pair opens a socket through a test server and returns the server side wrapped in a Conn and
// the client side.
func pair(t *testing.T) (*Conn, *websocket.Conn) {
	t.Helper()
	accepted := make(chan *websocket.Conn, 1)
	upgrader := websocket.Upgrader{}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ws, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			t.Error(err)
			return
		}
		accepted <- ws
	}))
	t.Cleanup(srv.Close)
	client, _, err := websocket.DefaultDialer.Dial("ws"+strings.TrimPrefix(srv.URL, "http"), nil)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = client.Close() })
	return New(<-accepted), client
}

func waitDone(t *testing.T, c *Conn) {
	t.Helper()
	select {
	case <-c.Done():
	case <-time.After(5 * time.Second):
		t.Fatal("socket not done")
	}
}

func TestSendDeliversFramesInOrderAndDrainsTheBuffer(t *testing.T) {
	c, client := pair(t)
	for _, frame := range []string{"one", "two", "three"} {
		c.Send([]byte(frame))
	}
	for _, want := range []string{"one", "two", "three"} {
		_, got, err := client.ReadMessage()
		if err != nil || string(got) != want {
			t.Fatalf("got %q %v, want %q", got, err, want)
		}
	}
	deadline := time.Now().Add(time.Second)
	for c.Buffered() != 0 && time.Now().Before(deadline) {
		time.Sleep(time.Millisecond)
	}
	if c.Buffered() != 0 {
		t.Errorf("buffered %d after delivery", c.Buffered())
	}
	c.Terminate()
}

func TestCloseSendsTheCodeAfterQueuedFramesAndIgnoresLaterSends(t *testing.T) {
	closeGrace = 10 * time.Millisecond
	t.Cleanup(func() { closeGrace = 2 * time.Second })
	c, client := pair(t)
	c.Send([]byte("last"))
	c.Close(4000, "bye")
	c.Close(4001, "again")
	c.Send([]byte("ignored"))
	if _, got, err := client.ReadMessage(); err != nil || string(got) != "last" {
		t.Fatalf("got %q %v", got, err)
	}
	_, _, err := client.ReadMessage()
	var closeErr *websocket.CloseError
	if ce, ok := err.(*websocket.CloseError); ok {
		closeErr = ce
	}
	if closeErr == nil || closeErr.Code != 4000 || closeErr.Text != "bye" {
		t.Fatalf("close %v", err)
	}
	// The socket itself closes after the grace period, answered or not.
	deadline := time.Now().Add(5 * time.Second)
	for c.ws.NetConn().SetDeadline(time.Time{}) == nil {
		if time.Now().After(deadline) {
			t.Fatal("socket still open after the grace period")
		}
		time.Sleep(5 * time.Millisecond)
	}
}

func TestAFailedWriteEndsTheSocket(t *testing.T) {
	c, _ := pair(t)
	_ = c.ws.Close()
	c.Send([]byte("into a closed socket"))
	waitDone(t, c)
}

func TestTerminateEndsAnIdleSocket(t *testing.T) {
	c, client := pair(t)
	c.Terminate()
	c.Terminate()
	waitDone(t, c)
	if _, _, err := client.ReadMessage(); err == nil {
		t.Error("client still reading")
	}
}

func TestPing(t *testing.T) {
	c, client := pair(t)
	pinged := make(chan struct{}, 1)
	client.SetPingHandler(func(string) error { pinged <- struct{}{}; return nil })
	go func() { _, _, _ = client.ReadMessage() }()
	if err := c.Ping(); err != nil {
		t.Fatal(err)
	}
	select {
	case <-pinged:
	case <-time.After(5 * time.Second):
		t.Fatal("no ping")
	}
	c.Terminate()
}
