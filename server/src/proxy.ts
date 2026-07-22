import express from "express";
import axios from "axios";
import type { AxiosResponse } from "axios";
import { proxyAgent } from "./config.js";

interface ProxyRequest {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
}

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

function forwardResponse(res: express.Response, response: AxiosResponse): void {
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

  res.send(response.data);
}

export function createProxyRouter(): express.Router {
  const router = express.Router();

  router.use(express.json({ limit: "10mb" }));

  router.post("/", async (req: express.Request, res: express.Response) => {
    const { url, method = "GET", headers = {}, body } = req.body as ProxyRequest;

    // Validate URL
    if (!url || typeof url !== "string" || !isValidUrl(url)) {
      res.status(400).json({ error: "Invalid or missing 'url' parameter" });
      return;
    }

    // Normalize method
    const normalizedMethod = method.toUpperCase();
    const allowedMethods = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];
    if (!allowedMethods.includes(normalizedMethod)) {
      res.status(400).json({ error: `Unsupported method: ${method}` });
      return;
    }

    try {
      const isHttps = new URL(url).protocol === "https:";

      const response = await axios({
        method: normalizedMethod,
        url,
        headers: {
          ...sanitizeForwardHeaders(req.headers as Record<string, string | string[] | undefined>),
          ...headers,
        },
        data: body,
        proxy: false,
        validateStatus: () => true,
        ...(isHttps ? { httpsAgent: proxyAgent } : {}),
        timeout: 30_000,
      });

      forwardResponse(res, response);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[proxy] request failed:", message);
      res.status(502).json({ error: "Proxy request failed", details: message });
    }
  });

  return router;
}
