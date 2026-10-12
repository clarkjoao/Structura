// Package awsx tunes the AWS SDK clients for a relay: many small concurrent calls to one host.
package awsx

import (
	"net/http"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/aws/ratelimit"
	"github.com/aws/aws-sdk-go-v2/aws/retry"
	awshttp "github.com/aws/aws-sdk-go-v2/aws/transport/http"
	"github.com/aws/aws-sdk-go-v2/config"
)

// HTTPClient keeps enough idle connections per host that a burst of posts reuses them instead
// of opening (and leaving in TIME_WAIT) a connection each.
func HTTPClient() *awshttp.BuildableClient {
	return awshttp.NewBuildableClient().WithTransportOptions(func(t *http.Transport) {
		t.MaxIdleConns = 1024
		t.MaxIdleConnsPerHost = 512
		t.IdleConnTimeout = 90 * time.Second
	})
}

// Retryer retries throttling and transient errors without the client-side retry quota, which
// under a burst refuses retries for every call at once.
func Retryer() aws.Retryer {
	return retry.NewStandard(func(o *retry.StandardOptions) {
		o.RateLimiter = ratelimit.None
		o.MaxAttempts = 4
	})
}

// LoadOptions applies both.
func LoadOptions() []func(*config.LoadOptions) error {
	return []func(*config.LoadOptions) error{
		config.WithHTTPClient(HTTPClient()),
		config.WithRetryer(func() aws.Retryer { return Retryer() }),
	}
}
