package serverless

import (
	"context"
	"os"
	"strings"
	"testing"
	"time"
)

func TestConfigFromEnv(t *testing.T) {
	for k, v := range map[string]string{
		"REDIS_URL": " redis://x ", "REDIS_NAMESPACE": "ns:", "TABLE_NAME": "", "DYNAMODB_ENDPOINT": "http://d",
		"CREATE_TABLE": "1", "CALLBACK_URL": "http://cb", "COLLAB_HOST_GRACE_MS": "1500", "COLLAB_MAX_PARTICIPANTS": " 7 ", "COLLAB_BATCH": "0",
	} {
		t.Setenv(k, v)
	}
	cfg := ConfigFromEnv()
	if cfg.RedisURL != "redis://x" || cfg.RedisNamespace != "ns:" || cfg.Table != "structura-collab" || cfg.DynamoEndpoint != "http://d" ||
		!cfg.CreateTable || cfg.CallbackURL != "http://cb" || cfg.Options.HostGrace != 1500*time.Millisecond ||
		cfg.Options.MaxParticipants != 7 || cfg.Options.Batch {
		t.Errorf("config %+v", cfg)
	}
	t.Setenv("TABLE_NAME", "mine")
	if ConfigFromEnv().Table != "mine" {
		t.Error("table name")
	}
}

func TestBuild(t *testing.T) {
	ctx := context.Background()
	srv := fakeConnections(t)
	t.Setenv("AWS_REGION", "")
	t.Setenv("AWS_DEFAULT_REGION", "")
	t.Setenv("AWS_ACCESS_KEY_ID", "")

	if _, err := Build(ctx, Config{RedisURL: "not a url"}, nil); err == nil || !strings.Contains(err.Error(), "REDIS_URL") {
		t.Errorf("bad Redis URL: %v", err)
	}
	if redisURL := os.Getenv("REDIS_URL"); redisURL != "" {
		h, err := Build(ctx, Config{RedisURL: redisURL, RedisNamespace: "build:", CallbackURL: srv.URL}, nil)
		if err != nil || h == nil {
			t.Errorf("Redis: %v", err)
		}
	}
	if endpoint := os.Getenv("DYNAMODB_ENDPOINT"); endpoint != "" {
		h, err := Build(ctx, Config{Table: "build-test", DynamoEndpoint: endpoint, CreateTable: true}, &gateway{})
		if err != nil || h == nil {
			t.Errorf("DynamoDB: %v", err)
		}
	}
	short, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()
	if _, err := Build(short, Config{Table: "t", DynamoEndpoint: "http://127.0.0.1:1", CreateTable: true}, &gateway{}); err == nil || !strings.Contains(err.Error(), "create table") {
		t.Errorf("unreachable DynamoDB: %v", err)
	}
	t.Setenv("AWS_PROFILE", "structura-test-profile-that-does-not-exist")
	t.Setenv("AWS_CONFIG_FILE", os.DevNull)
	if _, err := Build(ctx, Config{Table: "t"}, &gateway{}); err == nil {
		t.Error("DynamoDB client from a bad configuration")
	}
	if _, err := Build(ctx, Config{RedisURL: "redis://127.0.0.1:1"}, nil); err == nil {
		t.Error("API Gateway client from a bad configuration")
	}
}
