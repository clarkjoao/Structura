// Package faults injects failures into the store clients, for tests: a Redis hook and a DynamoDB
// middleware that fail chosen calls. Sweep uses them to drive every error path of an operation:
// it fails the 1st call, then the 2nd, and so on, until the operation makes fewer calls than that.
package faults

import (
	"context"
	"errors"
	"net"
	"sync"

	awsmiddleware "github.com/aws/aws-sdk-go-v2/aws/middleware"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/smithy-go/middleware"
	"github.com/redis/go-redis/v9"
)

// ErrInjected is the failure a plan injects unless told otherwise.
var ErrInjected = errors.New("faults: injected failure")

// Plan decides, call by call, which calls fail. The zero value fails nothing.
type Plan struct {
	mu     sync.Mutex
	calls  int
	from   int // the first failing call, 1-based; 0 fails nothing
	to     int // the last failing call; 0 means every call from `from` on
	match  func(name string) bool
	err    error
	fired  bool
	failed string
	before func(name string)
}

// FailAt fails only the n-th call from now.
func (p *Plan) FailAt(n int) { p.set(n, n) }

// FailFrom fails the n-th call from now and every one after it.
func (p *Plan) FailFrom(n int) { p.set(n, 0) }

// Off fails nothing and forgets the counters.
func (p *Plan) Off() { p.set(0, 0) }

func (p *Plan) set(from, to int) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.calls, p.from, p.to, p.fired = 0, from, to, false
}

// Only restricts the plan to calls whose name matches (nil counts every call).
func (p *Plan) Only(match func(name string) bool) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.match = match
}

// With makes failures return err instead of ErrInjected.
func (p *Plan) With(err error) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.err = err
}

// Before runs fn ahead of every counted call, before it is sent (or failed).
func (p *Plan) Before(fn func(name string)) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.before = fn
}

// Fired reports whether a call failed since the plan was last set.
func (p *Plan) Fired() bool {
	p.mu.Lock()
	defer p.mu.Unlock()
	return p.fired
}

// LastFailed names the last call the plan failed; setting the plan does not forget it.
func (p *Plan) LastFailed() string {
	p.mu.Lock()
	defer p.mu.Unlock()
	return p.failed
}

// Calls is how many counted calls were made since the plan was last set.
func (p *Plan) Calls() int {
	p.mu.Lock()
	defer p.mu.Unlock()
	return p.calls
}

// Check counts a call and returns the error it must fail with, if any.
func (p *Plan) Check(name string) error {
	p.mu.Lock()
	if p.match != nil && !p.match(name) {
		p.mu.Unlock()
		return nil
	}
	p.calls++
	n, before := p.calls, p.before
	fail := p.from > 0 && n >= p.from && (p.to == 0 || n <= p.to)
	err := p.err
	if fail {
		p.fired = true
		p.failed = name
	}
	p.mu.Unlock()
	if before != nil {
		before(name)
	}
	if !fail {
		return nil
	}
	if err == nil {
		err = ErrInjected
	}
	return err
}

// Sweep drives every error path of op. For n = 1, 2, …: it runs setup with nothing failing, then
// op with its n-th call failing, and stops at the first n op does not reach. check sees each
// injected run's error. It returns how many runs failed a call.
func Sweep(p *Plan, setup func(), op func() error, check func(n int, err error)) int {
	for n := 1; ; n++ {
		p.Off()
		setup()
		p.FailAt(n)
		err := op()
		fired := p.Fired()
		p.Off()
		if !fired {
			return n - 1
		}
		check(n, err)
	}
}

// ── Redis ──────────────────────────────────────────────────────────────────

// RedisHook fails commands (and whole pipelines) as the plan says. Calls are named by command:
// "evalsha", "hgetall", …
type RedisHook struct{ Plan *Plan }

func (h RedisHook) DialHook(next redis.DialHook) redis.DialHook {
	return func(ctx context.Context, network, addr string) (net.Conn, error) {
		return next(ctx, network, addr)
	}
}

func (h RedisHook) ProcessHook(next redis.ProcessHook) redis.ProcessHook {
	return func(ctx context.Context, cmd redis.Cmder) error {
		if err := h.Plan.Check(cmd.Name()); err != nil {
			cmd.SetErr(err)
			return err
		}
		return next(ctx, cmd)
	}
}

func (h RedisHook) ProcessPipelineHook(next redis.ProcessPipelineHook) redis.ProcessPipelineHook {
	return func(ctx context.Context, cmds []redis.Cmder) error {
		if err := h.Plan.Check("pipeline"); err != nil {
			for _, cmd := range cmds {
				cmd.SetErr(err)
			}
			return err
		}
		return next(ctx, cmds)
	}
}

// ── DynamoDB ───────────────────────────────────────────────────────────────

// Dynamo returns the client option that fails operations as the plan says. Calls are named by
// operation: "GetItem", "TransactWriteItems", …
func Dynamo(p *Plan) func(*dynamodb.Options) {
	return func(o *dynamodb.Options) {
		o.APIOptions = append(o.APIOptions, func(stack *middleware.Stack) error {
			return stack.Initialize.Add(middleware.InitializeMiddlewareFunc("faults",
				func(ctx context.Context, in middleware.InitializeInput, next middleware.InitializeHandler) (middleware.InitializeOutput, middleware.Metadata, error) {
					if err := p.Check(awsmiddleware.GetOperationName(ctx)); err != nil {
						return middleware.InitializeOutput{}, middleware.Metadata{}, err
					}
					return next.HandleInitialize(ctx, in)
				}), middleware.Before)
		})
	}
}

// DynamoReplies returns the client option that answers an operation itself whenever reply
// returns ok, without sending it.
func DynamoReplies(reply func(operation string, input any) (output any, ok bool)) func(*dynamodb.Options) {
	return func(o *dynamodb.Options) {
		o.APIOptions = append(o.APIOptions, func(stack *middleware.Stack) error {
			return stack.Initialize.Add(middleware.InitializeMiddlewareFunc("faults-replies",
				func(ctx context.Context, in middleware.InitializeInput, next middleware.InitializeHandler) (middleware.InitializeOutput, middleware.Metadata, error) {
					if out, ok := reply(awsmiddleware.GetOperationName(ctx), in.Parameters); ok {
						return middleware.InitializeOutput{Result: out}, middleware.Metadata{}, nil
					}
					return next.HandleInitialize(ctx, in)
				}), middleware.Before)
		})
	}
}

// Faulty returns a copy of a DynamoDB client whose calls go through the plan.
func Faulty(db *dynamodb.Client, p *Plan) *dynamodb.Client {
	return dynamodb.New(db.Options(), Dynamo(p))
}
