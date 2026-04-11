
export function newCollabRoomId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `room-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}


export function testServer(wsUrl: string, timeoutMs = 4000): Promise<boolean> {
  return new Promise((resolve) => {
    let done = false;
    let ws: WebSocket | null = null;

    const settle = (result: boolean) => {
      if (done) return;
      done = true;
      try {
        ws?.close();
      } catch {
        
      }
      resolve(result);
    };

    const timeout = setTimeout(() => settle(false), timeoutMs);

    try {
      ws = new WebSocket(wsUrl);
      ws.onopen = () => {
        clearTimeout(timeout);
        settle(true);
      };
      ws.onerror = () => {
        clearTimeout(timeout);
        settle(false);
      };
      ws.onclose = () => {
        clearTimeout(timeout);
        settle(false);
      };
    } catch {
      clearTimeout(timeout);
      settle(false);
    }
  });
}
