/**
 * Generic proxy client for forwarding HTTP requests through the dev proxy server.
 *
 * Used when direct API calls are blocked by CORS in corporate network environments.
 * The proxy is only available in development mode (NODE_ENV !== "production").
 */

const DEFAULT_PROXY_URL =
  typeof import.meta !== "undefined" && import.meta.env
    ? import.meta.env.VITE_LLM_PROXY_URL ?? "http://localhost:3000"
    : "http://localhost:3000";

export interface ProxyRequest {
  url: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";
  headers?: Record<string, string>;
  body?: unknown;
}

export interface ProxyResponse<T = unknown> {
  data: T;
  status: number;
  headers: Record<string, string>;
}

export async function proxyRequest<T = unknown>(
  request: ProxyRequest,
  proxyUrl?: string,
): Promise<ProxyResponse<T>> {
  const baseUrl = proxyUrl
    ? proxyUrl.endsWith("/")
      ? proxyUrl.slice(0, -1)
      : proxyUrl
    : DEFAULT_PROXY_URL.endsWith("/")
      ? DEFAULT_PROXY_URL.slice(0, -1)
      : DEFAULT_PROXY_URL;

  const response = await fetch(`${baseUrl}/proxy`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(`Proxy request failed: ${response.status} ${errorText}`);
  }

  const data = (await response.json()) as T;
  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });

  return {
    data,
    status: response.status,
    headers,
  };
}
