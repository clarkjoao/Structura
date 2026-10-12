package serverless

import (
	"context"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/clarkjoao/structura/go-server/internal/store"
)

// Config is how a serverless deployment is wired, read from the environment:
//
//	REDIS_URL           rooms in Redis (ElastiCache); otherwise DynamoDB
//	REDIS_NAMESPACE     key prefix in a shared Redis
//	TABLE_NAME          DynamoDB table (default structura-collab)
//	DYNAMODB_ENDPOINT   DynamoDB Local or another endpoint
//	CREATE_TABLE        "1" creates the table when missing (local runs)
//	CALLBACK_URL        @connections endpoint (custom domain, or the local emulator); by default
//	                    the endpoint of the API that invoked the function
//	COLLAB_HOST_GRACE_MS, COLLAB_MAX_PARTICIPANTS, COLLAB_BATCH ("0" sends one message per post)
type Config struct {
	RedisURL, RedisNamespace string
	Table, DynamoEndpoint    string
	CreateTable              bool
	CallbackURL              string
	Options                  Options
}

func envInt(key string) int {
	n, _ := strconv.Atoi(strings.TrimSpace(os.Getenv(key)))
	return n
}

// ConfigFromEnv reads the deployment's configuration.
func ConfigFromEnv() Config {
	table := strings.TrimSpace(os.Getenv("TABLE_NAME"))
	if table == "" {
		table = "structura-collab"
	}
	return Config{
		RedisURL:       strings.TrimSpace(os.Getenv("REDIS_URL")),
		RedisNamespace: strings.TrimSpace(os.Getenv("REDIS_NAMESPACE")),
		Table:          table,
		DynamoEndpoint: strings.TrimSpace(os.Getenv("DYNAMODB_ENDPOINT")),
		CreateTable:    os.Getenv("CREATE_TABLE") == "1",
		CallbackURL:    strings.TrimSpace(os.Getenv("CALLBACK_URL")),
		Options: Options{
			MaxParticipants: envInt("COLLAB_MAX_PARTICIPANTS"),
			HostGrace:       time.Duration(envInt("COLLAB_HOST_GRACE_MS")) * time.Millisecond,
			Batch:           os.Getenv("COLLAB_BATCH") != "0",
		},
	}
}

// Build wires a handler from a configuration.
func Build(ctx context.Context, cfg Config, poster Poster) (*Handler, error) {
	var rooms store.Rooms
	var reg Registry
	now := store.NowMs
	if cfg.RedisURL != "" {
		redisStore, err := store.NewRedis(cfg.RedisURL, store.RedisOptions{Namespace: cfg.RedisNamespace, Serverless: true})
		if err != nil {
			return nil, fmt.Errorf("REDIS_URL: %w", err)
		}
		rooms = redisStore
		reg = NewRedisRegistry(redisStore.Client(), cfg.RedisNamespace)
	} else {
		db, err := store.NewDynamoClient(ctx, cfg.DynamoEndpoint)
		if err != nil {
			return nil, err
		}
		if cfg.CreateTable {
			if err := store.EnsureTable(ctx, db, cfg.Table); err != nil {
				return nil, fmt.Errorf("create table %s: %w", cfg.Table, err)
			}
		}
		rooms = store.NewDynamo(db, cfg.Table, store.DynamoOptions{Now: now})
		reg = NewDynamoRegistry(db, cfg.Table, now)
	}
	if poster == nil {
		awsPoster, err := NewAWSPoster(ctx, cfg.CallbackURL)
		if err != nil {
			return nil, err
		}
		poster = awsPoster
	}
	cfg.Options.Now = now
	return New(rooms, reg, poster, cfg.Options), nil
}
