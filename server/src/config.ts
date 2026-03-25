import dotenv from "dotenv";
import path from "path";
import { HttpsProxyAgent } from "https-proxy-agent";
import https from "node:https";
import fs from "fs";

dotenv.config({ path: path.resolve(process.cwd(), "../.env") });

const paths = [
  path.resolve(process.cwd(), "../.env"),
  path.resolve(process.cwd(), "../../.env"),
];

const foundPath = paths.find(p => fs.existsSync(p));

if (foundPath) {
  dotenv.config({ path: foundPath });
} else {
  console.warn("⚠️ Nenhum .env encontrado nos paths esperados");
}

export const PORT = Number(process.env.PORT ?? process.env.PROXY_REVERSE_PORT ?? 3000);

export const DEFECTDOJO_URL        = process.env.PROXY_REVERSE_DEFECTDOJO_URL ?? "";
export const DEFECTDOJO_API_TOKEN  = process.env.PROXY_REVERSE_DEFECTDOJO_API_TOKEN;
export const GITHUB_URL            = process.env.PROXY_REVERSE_GITHUB_URL ?? "";
export const GITHUB_API_TOKEN      = process.env.PROXY_REVERSE_GITHUB_API_TOKEN;
export const INSECURE_TLS          = process.env.PROXY_REVERSE_INSECURE_TLS === "true";

if (INSECURE_TLS) process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

function normalizeProxyUrl(raw: string | undefined): string | undefined {
  const v = raw?.trim();
  if (!v) return undefined;
  return v.startsWith("http://") || v.startsWith("https://") ? v : `http://${v}`;
}

const CORPORATE_PROXY_URL =
  normalizeProxyUrl(process.env.PROXY_REVERSE_INTERNAL_HTTP_PROXY) ||
  normalizeProxyUrl(process.env.PROXY_REVERSE_INTERNAL_HTTPS_PROXY) ||
  normalizeProxyUrl(process.env.HTTP_PROXY) ||
  normalizeProxyUrl(process.env.HTTPS_PROXY);

export const proxyAgent = CORPORATE_PROXY_URL
  ? new HttpsProxyAgent(CORPORATE_PROXY_URL, { keepAlive: true })
  : new https.Agent({ keepAlive: true, rejectUnauthorized: !INSECURE_TLS });

export const WS_PATH = process.env.WS_PATH ?? "/ws";
