import type { ViewBox, ViewPlacer } from "./generated/opscr-mapping";

/** How long a placement waits for the webview — loading included — before it fails. */
export const PLACE_TIMEOUT_MS = 30_000;

type PlaceInput = Parameters<ViewPlacer["place"]>[0];

interface Pending {
  message: { type: "STRUCTURA_PLACE"; id: number; arrange?: object } & PlaceInput;
  resolve: (result: { boxes: Record<string, ViewBox> }) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isBox = (value: unknown): value is ViewBox =>
  isRecord(value) &&
  ["x", "y", "width", "height"].every(
    (k) => typeof value[k] === "number" && Number.isFinite(value[k]),
  );

/**
 * Structura's placement, reached through the preview's webview: the extension neither sizes nor
 * places anything itself. Each `place` posts `STRUCTURA_PLACE` to the embed, which answers with
 * `api.layout.place`'s own implementation (`STRUCTURA_PLACE_RESULT`, see the host's
 * `src/embed/protocol.ts`) — so the preview is placed exactly as Structura places a plugin's
 * diagram, under the Arrange settings `arrange()` gives (spacing).
 *
 * Requests made before the webview is ready wait for it, and are posted again if it reloads; one
 * that gets no answer in `PLACE_TIMEOUT_MS` fails. No VSCode API here: `post` is the webview's.
 */
export class WebviewPlacer implements ViewPlacer {
  private readonly pending = new Map<number, Pending>();
  private nextId = 1;
  private isReady = false;
  private disposed = false;

  constructor(
    private readonly post: (message: object) => void,
    /** The `arrange` posted with each request: the Arrange settings to place under. */
    private readonly arrange: () => object | undefined = () => undefined,
    private readonly timeoutMs: number = PLACE_TIMEOUT_MS,
  ) {}

  place(input: PlaceInput): Promise<{ boxes: Record<string, ViewBox> }> {
    if (this.disposed) return Promise.reject(new Error("[opscr] the preview is closed"));
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error("[opscr] the preview did not answer the placement request"));
      }, this.timeoutMs);
      const arrange = this.arrange();
      const entry: Pending = {
        message: { type: "STRUCTURA_PLACE", id, ...input, ...(arrange && { arrange }) },
        resolve,
        reject,
        timer,
      };
      this.pending.set(id, entry);
      if (this.isReady) this.post(entry.message);
    });
  }

  /** The webview (re)loaded: what it has not answered is posted again — a reload lost it. */
  ready(): void {
    this.isReady = true;
    for (const entry of this.pending.values()) this.post(entry.message);
  }

  /** The webview is going away or reloading: nothing is posted until it is ready again. */
  unready(): void {
    this.isReady = false;
  }

  /** A `STRUCTURA_PLACE_RESULT`; anything that is not an answer to a pending request is ignored. */
  receive(message: unknown): void {
    if (!isRecord(message) || typeof message["id"] !== "number") return;
    const entry = this.pending.get(message["id"]);
    if (!entry) return;
    this.pending.delete(message["id"]);
    clearTimeout(entry.timer);
    if (typeof message["error"] === "string") {
      entry.reject(new Error(`[opscr] placement failed in the preview: ${message["error"]}`));
      return;
    }
    const boxes: Record<string, ViewBox> = {};
    if (isRecord(message["boxes"])) {
      for (const [key, box] of Object.entries(message["boxes"])) if (isBox(box)) boxes[key] = box;
    }
    entry.resolve({ boxes });
  }

  /** The preview closed: every pending placement fails now instead of at its timeout. */
  dispose(): void {
    this.disposed = true;
    this.isReady = false;
    for (const entry of this.pending.values()) {
      clearTimeout(entry.timer);
      entry.reject(new Error("[opscr] the preview is closed"));
    }
    this.pending.clear();
  }
}
