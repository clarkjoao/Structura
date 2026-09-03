import express from "express";
import axios from "axios";
import { proxyAgent } from "./config.js";

function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function sanitizeForwardHeaders(
  reqHeaders: Record<string, string | string[] | undefined>,
): Record<string, string> {
  const hopByHop = new Set([
    "host",
    "connection",
    "content-length",
    "transfer-encoding",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailers",
    "upgrade",
  ]);
  const sanitized: Record<string, string> = {};
  for (const [k, v] of Object.entries(reqHeaders)) {
    if (k && !hopByHop.has(k.toLowerCase()) && v !== undefined) {
      sanitized[k] = Array.isArray(v) ? v[0] : v;
    }
  }
  return sanitized;
}

function maskSensitiveHeaders(headers: Record<string, string>): Record<string, string> {
  const masked = { ...headers };
  const sensitiveKeys = ["authorization", "x-api-key", "api-key", "token", "cookie"];
  for (const key of Object.keys(masked)) {
    if (sensitiveKeys.some((s) => key.toLowerCase().includes(s))) {
      const value = masked[key];
      masked[key] = value.length > 8 ? `${value.slice(0, 4)}...${value.slice(-4)}` : "****";
    }
  }
  return masked;
}

/** Masks query parameters that may contain sensitive data in logs. */
function maskQueryParams(url: string): string {
  try {
    const urlObj = new URL(url);
    const sensitiveParams = [
      "token",
      "key",
      "secret",
      "password",
      "auth",
      "bearer",
      "api_key",
      "api-key",
      "access_token",
      "refresh_token",
      "session",
    ];
    let hasMasked = false;
    for (const key of urlObj.searchParams.keys()) {
      if (sensitiveParams.some((s) => key.toLowerCase().includes(s))) {
        urlObj.searchParams.set(key, "****");
        hasMasked = true;
      }
    }
    // If sensitive params were masked, also truncate long query strings
    if (hasMasked || urlObj.search.length > 200) {
      const truncated = urlObj.toString();
      return truncated.length > 200 ? `${truncated.slice(0, 200)}...[truncated]` : truncated;
    }
    return url;
  } catch {
    return url;
  }
}

function getUpstreamUrl(targetUrl: string, query: express.Request["query"]): string {
  const upstreamUrl = new URL(targetUrl);

  // Remove default port for cleaner URLs
  if (
    (upstreamUrl.port === "80" && upstreamUrl.protocol === "http:") ||
    (upstreamUrl.port === "443" && upstreamUrl.protocol === "https:")
  ) {
    upstreamUrl.port = "";
  }

  // Preserve the path and search from the target URL
  // (upstreamUrl already has pathname and search from the URL constructor)

  // Merge additional query params from the request
  for (const [key, value] of Object.entries(query)) {
    if (key !== "url" && key !== "method") {
      upstreamUrl.searchParams.set(key, value as string);
    }
  }

  return upstreamUrl.toString();
}

export function createProxyRouter(): express.Router {
  const router = express.Router();

  router.use(express.json({ limit: "10mb" }));

  router.all("/", async (req: express.Request, res: express.Response) => {
    const startTime = Date.now();
    const targetUrl = req.query.url as string | undefined;
    const clientIp = req.ip || req.socket.remoteAddress || "unknown";

    // Validate URL
    if (!targetUrl || typeof targetUrl !== "string" || !isValidUrl(targetUrl)) {
      console.warn(`[proxy] ❌ 400 | ${req.method} | Invalid URL: ${targetUrl}`);
      res.status(400).json({ error: "Missing or invalid 'url' query parameter" });
      return;
    }

    // Normalize method from query or infer from request
    const methodFromQuery = (req.query.method as string | undefined)?.toUpperCase();
    const method = methodFromQuery || req.method;

    // Only allow safe methods
    const allowedMethods = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];
    if (!allowedMethods.includes(method)) {
      console.warn(`[proxy] ❌ 400 | ${method} | Unsupported method`);
      res.status(400).json({ error: `Unsupported method: ${method}` });
      return;
    }

    try {
      const isHttps = new URL(targetUrl).protocol === "https:";

      // Build upstream URL (includes path and query from ?url=)
      const upstreamUrl = getUpstreamUrl(targetUrl, req.query);

      // Merge headers: forward headers from original request + body headers
      const mergedHeaders: Record<string, string> = {
        ...sanitizeForwardHeaders(req.headers as Record<string, string | string[] | undefined>),
      };

      // For POST/PUT/PATCH with body, ensure Content-Type is set
      const hasBody =
        ["POST", "PUT", "PATCH"].includes(method) && Object.keys(req.body || {}).length > 0;
      if (hasBody && !mergedHeaders["content-type"]) {
        mergedHeaders["content-type"] = "application/json";
      }

      console.log(
        `[proxy] → ${method} ${maskQueryParams(upstreamUrl)}\n    From: ${clientIp}\n    Headers: ${JSON.stringify(maskSensitiveHeaders(mergedHeaders))}`,
      );

      const response = await axios({
        method,
        url: upstreamUrl,
        headers: mergedHeaders,
        data: hasBody ? req.body : undefined,
        proxy: false,
        validateStatus: () => true,
        maxRedirects: 5,
        ...(isHttps ? { httpsAgent: proxyAgent } : {}),
        timeout: 30_000,
      });

      const elapsed = Date.now() - startTime;
      const redirectedTo = response.request?.res?.responseUrl
        ? `\n    Redirected to: ${response.request.res.responseUrl}`
        : "";

      console.log(
        `[proxy] ← ${response.status} | ${elapsed}ms${redirectedTo}\n    Response headers: ${JSON.stringify(
          maskSensitiveHeaders(response.headers as Record<string, string>),
        )}`,
      );

      // Forward response status
      res.status(response.status);

      // Forward headers (except hop-by-hop)
      for (const [key, value] of Object.entries(response.headers)) {
        if (
          value !== undefined &&
          !["content-encoding", "transfer-encoding", "connection"].includes(key.toLowerCase())
        ) {
          res.setHeader(key, value);
        }
      }

      // Send response body
      res.send(response.data);
    } catch (err: unknown) {
      const elapsed = Date.now() - startTime;
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        `[proxy] ❌ 502 | ${method} ${maskQueryParams(targetUrl)} | ${elapsed}ms | Error: ${message}`,
      );
      res.status(502).json({ error: "Proxy request failed", details: message });
    }
  });

  return router;
}
