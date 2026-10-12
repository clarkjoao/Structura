# Long-lived relay image (ECS, Kubernetes, single host). The Lambda handler is built separately:
# see deploy/aws/README.md.
FROM golang:1.27-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/relay ./cmd/relay

FROM alpine:3.22
RUN adduser -D -H -u 10001 relay
USER 10001
COPY --from=build /out/relay /usr/local/bin/relay
ENV PORT=3000
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:${PORT:-3000}/health || exit 1
ENTRYPOINT ["/usr/local/bin/relay"]
