import express from "express";
import cors from "cors";
import axios from "axios";
import {
  DEFECTDOJO_URL,
  DEFECTDOJO_API_TOKEN,
  GITHUB_URL,
  GITHUB_API_TOKEN,
  proxyAgent,
} from "./config.js";

function buildUpstreamUrl(upstreamBase: string, prefix: string, originalUrl: string): string {
  const targetPath = originalUrl.slice(prefix.length);
  const base = upstreamBase.replace(/\/+$/, "");
  const normalized = targetPath.startsWith("/") ? targetPath : `/${targetPath}`;
  return `${base}${normalized}`;
}

function sanitizeForwardHeaders(req: express.Request): Record<string, string | string[]> {
  const hopByHop = new Set(["host", "connection", "content-length", "transfer-encoding"]);
  const headers: Record<string, string | string[]> = {};
  for (const [k, v] of Object.entries(req.headers)) {
    if (k && !hopByHop.has(k.toLowerCase())) headers[k] = v as string | string[];
  }
  return headers;
}

interface ProxyOptions {
  fallbackAuth?: string;
  authScheme?: string;
}

function createProxy(
  prefix: string,
  upstreamBase: string,
  opts: ProxyOptions = {},
): express.RequestHandler {
  return async (req, res) => {
    try {
      const url = buildUpstreamUrl(upstreamBase, prefix, req.originalUrl);
      const headers = sanitizeForwardHeaders(req);

      if (!headers.authorization && opts.fallbackAuth) {
        headers.authorization = opts.authScheme
          ? `${opts.authScheme} ${opts.fallbackAuth}`
          : opts.fallbackAuth;
      }

      const hasBody = req.method !== "GET" && req.method !== "HEAD";
      if (hasBody && req.body && !headers["content-type"]) {
        headers["content-type"] = "application/json";
      }

      const isHttps = new URL(url).protocol === "https:";

      const response = await axios({
        method: req.method,
        url,
        headers,
        proxy: false,
        validateStatus: () => true,
        ...(isHttps ? { httpsAgent: proxyAgent } : {}),
        ...(hasBody ? { data: req.body } : {}),
      });

      res.status(response.status).set(response.headers).send(response.data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[proxy] error on ${prefix}:`, message);
      res.status(500).json({ error: "Proxy failed", details: message });
    }
  };
}

export function createProxyRouter(): express.Router {
  const router = express.Router();

  router.use(cors());
  router.use(express.json());

  router.use(
    "/dojo",
    createProxy("/dojo", DEFECTDOJO_URL, {
      fallbackAuth: DEFECTDOJO_API_TOKEN,
      authScheme: "Token",
    }),
  );

  router.use(
    "/github",
    createProxy("/github", GITHUB_URL, {
      fallbackAuth: GITHUB_API_TOKEN,
      authScheme: "Bearer",
    }),
  );

  return router;
}
