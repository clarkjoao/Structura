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
  // Use proxyUrl if provided, otherwise default
  // User should provide the full proxy URL including /proxy path if needed
  let baseUrl = proxyUrl || DEFAULT_PROXY_URL;

  // Remove trailing slashes
  baseUrl = baseUrl.replace(/\/+$/, "");

  // If user didn't include /proxy in the URL, add it
  if (!baseUrl.endsWith("/proxy")) {
    baseUrl = `${baseUrl}/proxy`;
  }

  // Build query string with URL and method
  const params = new URLSearchParams({
    url: request.url,
  });
  if (request.method && request.method !== "GET") {
    params.set("method", request.method);
  }

  const proxyEndpoint = `${baseUrl}?${params.toString()}`;

  const fetchOptions: RequestInit = {
    method: request.method && request.method !== "GET" ? request.method : "GET",
    headers: {
      "Content-Type": "application/json",
      ...request.headers, // Merge custom headers (Authorization, etc.)
    },
  };

  // Add body for non-GET requests
  if (request.method !== "GET" && request.body !== undefined) {
    fetchOptions.body = JSON.stringify(request.body);
  }

  const response = await fetch(proxyEndpoint, fetchOptions);

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
