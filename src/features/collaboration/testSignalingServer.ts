/**
 * Tests if a signaling server is reachable.
 */
export function testSignalingServer(wsUrl: string, timeoutMs = 4000): Promise<boolean> {
  return new Promise((resolve) => {
    let resolved = false;
    let ws: WebSocket | null = null;

    const done = (result: boolean) => {
      if (resolved) return;
      resolved = true;
      try {
        ws?.close();
      } catch {
        // Ignore close errors.
      }
      resolve(result);
    };

    const timeout = setTimeout(() => done(false), timeoutMs);

    try {
      ws = new WebSocket(wsUrl);
      ws.onopen = () => {
        clearTimeout(timeout);
        done(true);
      };
      ws.onerror = () => {
        clearTimeout(timeout);
        done(false);
      };
      ws.onclose = () => {
        clearTimeout(timeout);
        done(false);
      };
    } catch {
      clearTimeout(timeout);
      done(false);
    }
  });
}
