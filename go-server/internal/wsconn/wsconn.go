// Package wsconn wraps a gorilla WebSocket with a non-blocking, ordered send queue that knows how
// many bytes it holds (the `bufferedAmount` the relay's backpressure reads) and a heartbeat.
package wsconn

import (
	"sync"
	"sync/atomic"
	"time"

	"github.com/gorilla/websocket"
)

// closeGrace is how long the peer has to answer the close handshake before the socket closes.
var closeGrace = 2 * time.Second

type item struct {
	frame  []byte
	close  bool
	code   int
	reason string
}

// Conn is one socket.
type Conn struct {
	ws       *websocket.Conn
	mu       sync.Mutex
	queue    []item
	signal   chan struct{}
	buffered atomic.Int64
	closing  atomic.Bool
	done     chan struct{}
	once     sync.Once
	grace    time.Duration
}

// New starts the writer of a socket.
func New(ws *websocket.Conn) *Conn {
	c := &Conn{ws: ws, signal: make(chan struct{}, 1), done: make(chan struct{}), grace: closeGrace}
	go c.writeLoop()
	return c
}

// Send queues a text frame.
func (c *Conn) Send(frame []byte) {
	if c.closing.Load() {
		return
	}
	c.buffered.Add(int64(len(frame)))
	c.push(item{frame: frame})
}

// Close sends a close frame after everything already queued, then closes the socket.
func (c *Conn) Close(code int, reason string) {
	if c.closing.Swap(true) {
		return
	}
	c.push(item{close: true, code: code, reason: reason})
}

// Buffered is the number of queued bytes not yet written.
func (c *Conn) Buffered() int { return int(c.buffered.Load()) }

// Done is closed once the socket is gone.
func (c *Conn) Done() <-chan struct{} { return c.done }

// Terminate drops the socket at once.
func (c *Conn) Terminate() {
	c.closing.Store(true)
	_ = c.ws.Close()
	c.finish()
}

func (c *Conn) finish() { c.once.Do(func() { close(c.done) }) }

func (c *Conn) push(it item) {
	c.mu.Lock()
	c.queue = append(c.queue, it)
	c.mu.Unlock()
	select {
	case c.signal <- struct{}{}:
	default:
	}
}

func (c *Conn) writeLoop() {
	for {
		select {
		case <-c.done:
			return
		case <-c.signal:
		}
		for {
			c.mu.Lock()
			if len(c.queue) == 0 {
				c.mu.Unlock()
				break
			}
			batch := c.queue
			c.queue = nil
			c.mu.Unlock()
			for _, it := range batch {
				_ = c.ws.SetWriteDeadline(time.Now().Add(30 * time.Second))
				if it.close {
					msg := websocket.FormatCloseMessage(it.code, it.reason)
					_ = c.ws.WriteControl(websocket.CloseMessage, msg, time.Now().Add(time.Second))
					time.AfterFunc(c.grace, func() { _ = c.ws.Close() })
					return
				}
				err := c.ws.WriteMessage(websocket.TextMessage, it.frame)
				c.buffered.Add(-int64(len(it.frame)))
				if err != nil {
					_ = c.ws.Close()
					c.finish()
					return
				}
			}
		}
	}
}

// Ping sends a ping control frame.
func (c *Conn) Ping() error {
	return c.ws.WriteControl(websocket.PingMessage, nil, time.Now().Add(5*time.Second))
}
