package relay

import "sync"

// TokenBucket refills `rate` tokens per second and holds at most `burst`.
type TokenBucket struct {
	mu     sync.Mutex
	rate   float64
	burst  float64
	tokens float64
	last   int64
	now    func() int64
}

// Rate is a bucket configuration.
type Rate struct {
	Rate  float64
	Burst float64
}

// NewTokenBucket starts full.
func NewTokenBucket(r Rate, now func() int64) *TokenBucket {
	return &TokenBucket{rate: r.Rate, burst: r.Burst, tokens: r.Burst, last: now(), now: now}
}

// Take spends one token; false when none is left.
func (b *TokenBucket) Take() bool {
	b.mu.Lock()
	defer b.mu.Unlock()
	t := b.now()
	b.tokens = min(b.burst, b.tokens+float64(t-b.last)/1000*b.rate)
	b.last = t
	if b.tokens < 1 {
		return false
	}
	b.tokens--
	return true
}
