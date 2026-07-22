import type { DefectDojoConfig } from "./types";
import { proxyRequest } from "../proxy";

export class DefectDojoClient {
  constructor(private config: DefectDojoConfig) {}

  async get<T>(path: string, params?: Record<string, string>): Promise<T> {
    const baseUrl = this.config.baseUrl.replace(/\/$/, "");
    const url = new URL(`${baseUrl}/api/v2${path}`);
    if (params) {
      Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    }

    const headers: Record<string, string> = {
      Authorization: `Token ${this.config.apiToken}`,
      "Content-Type": "application/json",
    };

    if (this.config.useProxy) {
      const response = await proxyRequest<T>(
        {
          url: url.toString(),
          method: "GET",
          headers,
        },
        this.config.proxyUrl,
      );
      return response.data;
    }

    const res = await fetch(url.toString(), {
      headers,
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`DefectDojo ${res.status}: ${body}`);
    }

    return res.json() as Promise<T>;
  }
}
