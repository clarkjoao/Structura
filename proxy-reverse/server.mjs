import express from "express";
import cors from "cors";
import axios from "axios";
import https from "https";
import dotenv from "dotenv";
import path from "path";

import { HttpProxyAgent } from "http-proxy-agent";

dotenv.config({
  path: path.resolve(process.cwd(), "../.env"),
});

const app = express();

const PORT = process.env.PROXY_REVERSE_PORT || 3000;
const DEFECTDOJO_URL = process.env.PROXY_REVERSE_DEFECTDOJO_URL;
const GITHUB_URL = process.env.PROXY_REVERSE_GITHUB_URL;
const INSECURE_TLS = process.env.PROXY_REVERSE_INSECURE_TLS === "true";
const DEFECTDOJO_API_TOKEN = process.env.PROXY_REVERSE_DEFECTDOJO_API_TOKEN;
const GITHUB_API_TOKEN = process.env.PROXY_REVERSE_GITHUB_API_TOKEN;
const CORPORATE_PROXY_URL = process.env.INTERNAL_HTTP_PROXY || process.env.INTERNAL_HTTPS_PROXY;

app.use(cors());
app.use(express.json());

const httpsAgentInsecure = new https.Agent({
  rejectUnauthorized: true,
});


const corporateAgent = CORPORATE_PROXY_URL
  ? new HttpProxyAgent(CORPORATE_PROXY_URL)
  : undefined;

function buildUpstreamUrl(upstreamBase, prefix, originalUrl) {
  const targetPath = originalUrl.slice(prefix.length);
  const upstreamBaseUrl = upstreamBase.replace(/\/+$/, "");
  const normalizedTargetPath = targetPath.startsWith("/")
    ? targetPath
    : `/${targetPath}`;
  return `${upstreamBaseUrl}${normalizedTargetPath}`;
}

function sanitizeForwardHeaders(req) {
  const hopByHop = new Set([
    "host",
    "connection",
    "content-length",
    "transfer-encoding",
  ]);
  const headers = {};
  for (const [k, v] of Object.entries(req.headers)) {
    if (!k) continue;
    if (hopByHop.has(k.toLowerCase())) continue;
    headers[k] = v;
  }
  return headers;
}

function createProxy(prefix, upstreamBase, { fallbackAuth, authScheme, proxyAgent, insecureTLS }) {
  return async (req, res) => {
    try {
      const url = buildUpstreamUrl(upstreamBase, prefix, req.originalUrl);

      const headers = sanitizeForwardHeaders(req);

      // Preserve caller Authorization. If none was provided, fall back to server-side token.
      if (!headers.authorization && fallbackAuth) {
        headers.authorization = authScheme
          ? `${authScheme} ${fallbackAuth}`
          : fallbackAuth;
      }

      const shouldHaveBody = req.method !== "GET" && req.method !== "HEAD";
      if (shouldHaveBody && req.body && !headers["content-type"]) {
        headers["content-type"] = "application/json";
      }

      const axiosConfig = {
        method: req.method,
        url,
        headers,
        proxy: false,
        validateStatus: () => true, // Accept all status codes
        ...proxyAgent ? { proxy: proxyAgent } : {},
        ...insecureTLS ? { httpsAgent: httpsAgentInsecure } : {},
      };

      if (shouldHaveBody) axiosConfig.data = req.body;

      const response = await axios(axiosConfig);

      res.status(response.status);
      res.set(response.headers);
      res.send(response.data);
    } catch (error) {
      console.error(`Proxy error (${prefix}):`, error?.message ?? error);
      res
        .status(500)
        .json({ error: "Proxy failed", details: error?.message ?? String(error) });
    }
  };
}

app.use(
  "/dojo",
  createProxy("/dojo", DEFECTDOJO_URL, {
    fallbackAuth: DEFECTDOJO_API_TOKEN,
    authScheme: "Token",
    insecureTLS: INSECURE_TLS,
  }),
);

app.use(
  "/github",
  createProxy("/github", GITHUB_URL, {
    fallbackAuth: GITHUB_API_TOKEN,
    authScheme: "Bearer",
    proxyAgent: corporateAgent,
  }),
);

app.listen(PORT, () => {
  console.log(`Proxy running on http://localhost:${PORT}`);
  console.log(`Forwarding to ${DEFECTDOJO_URL}`);
  console.log(`TLS insecure mode: ${INSECURE_TLS}`);
});
