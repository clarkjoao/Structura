import type { DefectDojoConfig } from "./types";

export class DefectDojoClient {
  constructor(private config: DefectDojoConfig) {}

  async get<T>(path: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(`${this.config.baseUrl}/api/v2${path}`);
    if (params) {
      Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    }

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Token ${this.config.apiToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`DefectDojo ${res.status}: ${body}`);
    }

    return res.json() as Promise<T>;
  }
}
