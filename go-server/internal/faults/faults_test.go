package faults

import (
	"context"
	"errors"
	"os"
	"testing"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/redis/go-redis/v9"
)

func TestPlanCountsMatchingCallsAndFailsTheChosenOnes(t *testing.T) {
	var p Plan
	if p.Check("a") != nil || p.Fired() {
		t.Fatal("zero plan failed a call")
	}
	p.FailAt(2)
	if p.Check("a") != nil {
		t.Error("call 1 failed")
	}
	if !errors.Is(p.Check("a"), ErrInjected) || !p.Fired() {
		t.Error("call 2 did not fail")
	}
	if p.Check("a") != nil {
		t.Error("call 3 failed under FailAt")
	}

	custom := errors.New("custom")
	p.With(custom)
	p.FailFrom(1)
	p.Only(func(name string) bool { return name == "x" })
	var seen []string
	p.Before(func(name string) { seen = append(seen, name) })
	if p.Check("y") != nil {
		t.Error("unmatched call failed")
	}
	if p.Check("x") != custom || p.Check("x") != custom || p.Calls() != 2 || p.LastFailed() != "x" {
		t.Errorf("FailFrom: calls %d", p.Calls())
	}
	if len(seen) != 2 {
		t.Errorf("before saw %v", seen)
	}
	p.Off()
	if p.Check("x") != nil || p.Fired() || p.Calls() != 1 {
		t.Error("Off still fails")
	}
}

func TestSweepStopsWhenTheOperationRunsOutOfCalls(t *testing.T) {
	var p Plan
	setups := 0
	var failedAt []int
	runs := Sweep(&p, func() { setups++ }, func() error {
		for i := 0; i < 3; i++ {
			if err := p.Check("call"); err != nil {
				return err
			}
		}
		return nil
	}, func(n int, err error) {
		if !errors.Is(err, ErrInjected) {
			t.Errorf("run %d: %v", n, err)
		}
		failedAt = append(failedAt, n)
	})
	if runs != 3 || setups != 4 || len(failedAt) != 3 {
		t.Errorf("runs %d setups %d failed %v", runs, setups, failedAt)
	}
}

func TestRedisHookFailsCommandsAndPipelines(t *testing.T) {
	url := os.Getenv("REDIS_URL")
	if url == "" {
		t.Skip("REDIS_URL not set")
	}
	opts, err := redis.ParseURL(url)
	if err != nil {
		t.Fatal(err)
	}
	client := redis.NewClient(opts)
	defer client.Close()
	var p Plan
	client.AddHook(RedisHook{Plan: &p})
	ctx := context.Background()

	if err := client.Ping(ctx).Err(); err != nil {
		t.Fatalf("ping through an idle plan: %v", err)
	}
	p.FailAt(1)
	if err := client.Ping(ctx).Err(); !errors.Is(err, ErrInjected) {
		t.Errorf("ping: %v", err)
	}
	p.FailAt(1)
	cmds, err := client.Pipelined(ctx, func(pipe redis.Pipeliner) error {
		pipe.Ping(ctx)
		pipe.Ping(ctx)
		return nil
	})
	if !errors.Is(err, ErrInjected) || len(cmds) != 2 || !errors.Is(cmds[1].Err(), ErrInjected) {
		t.Errorf("pipeline: %v", err)
	}
	p.Off()
	if _, err := client.Pipelined(ctx, func(pipe redis.Pipeliner) error { pipe.Ping(ctx); return nil }); err != nil {
		t.Errorf("pipeline through an idle plan: %v", err)
	}
}

func TestDynamoMiddlewareFailsOperations(t *testing.T) {
	endpoint := os.Getenv("DYNAMODB_ENDPOINT")
	if endpoint == "" {
		t.Skip("DYNAMODB_ENDPOINT not set")
	}
	db := dynamodb.New(dynamodb.Options{
		Region:       "us-east-1",
		BaseEndpoint: aws.String(endpoint),
		Credentials:  credentials.NewStaticCredentialsProvider("local", "local", ""),
	})
	var p Plan
	faulty := Faulty(db, &p)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if _, err := faulty.ListTables(ctx, &dynamodb.ListTablesInput{}); err != nil {
		t.Fatalf("idle plan: %v", err)
	}
	var names []string
	p.Before(func(name string) { names = append(names, name) })
	p.FailAt(1)
	if _, err := faulty.ListTables(ctx, &dynamodb.ListTablesInput{}); !errors.Is(err, ErrInjected) {
		t.Errorf("ListTables: %v", err)
	}
	if len(names) != 1 || names[0] != "ListTables" {
		t.Errorf("names %v", names)
	}

	answered := dynamodb.New(db.Options(), DynamoReplies(func(op string, in any) (any, bool) {
		if _, ok := in.(*dynamodb.ListTablesInput); ok && op == "ListTables" {
			return &dynamodb.ListTablesOutput{TableNames: []string{"made-up"}}, true
		}
		return nil, false
	}))
	out, err := answered.ListTables(ctx, &dynamodb.ListTablesInput{})
	if err != nil || len(out.TableNames) != 1 || out.TableNames[0] != "made-up" {
		t.Errorf("replied: %v %v", out, err)
	}
	if _, err := answered.DescribeLimits(ctx, &dynamodb.DescribeLimitsInput{}); err != nil {
		t.Errorf("passed through: %v", err)
	}
}
