import type { ElkNode } from "elkjs";

/** What the layout engine needs from ELK. */
interface ElkRunner {
  layout(graph: ElkNode): Promise<ElkNode>;
}

/** The worker died or never loaded: unlike a layout error, ELK on the main thread can still answer. */
class ElkWorkerFailure extends Error {
  constructor(readonly reason: unknown) {
    super("ELK worker failed");
    this.name = "ElkWorkerFailure";
  }
}

/**
 * ELK in a Web Worker, so a whole-diagram layout (~2 s on a 657-element
 * diagram, run once per auto-reference trial) does not freeze the page. One
 * worker for the session: it parses ~1.5 MB of ELK once.
 *
 * `elk-api` waits for the worker's answer with no timeout, so a worker that
 * fails to load or dies would leave every layout pending forever. Its error
 * event rejects what is in flight instead, and the caller falls back to ELK on
 * the main thread.
 */
async function createWorkerRunner(): Promise<ElkRunner> {
  const [{ default: ElkApi }, { default: workerUrl }] = await Promise.all([
    import("elkjs/lib/elk-api.js"),
    import("elkjs/lib/elk-worker.min.js?url"),
  ]);
  let failure: ElkWorkerFailure | null = null;
  const rejectors = new Set<(reason: unknown) => void>();
  const elk = new ElkApi({
    workerFactory: () => {
      const worker = new Worker(workerUrl);
      worker.addEventListener("error", (event) => {
        failure = new ElkWorkerFailure(event.error ?? event.message);
        for (const reject of rejectors) reject(failure);
        rejectors.clear();
      });
      return worker;
    },
  });
  return {
    layout(graph) {
      if (failure !== null) return Promise.reject(failure);
      return new Promise<ElkNode>((resolve, reject) => {
        rejectors.add(reject);
        elk.layout(graph).then(
          (result) => {
            rejectors.delete(reject);
            resolve(result);
          },
          (error: unknown) => {
            rejectors.delete(reject);
            reject(error);
          },
        );
      });
    },
  };
}

async function createMainThreadRunner(): Promise<ElkRunner> {
  // Dynamic import to keep ELK's ~1.5 MB out of the initial bundle.
  const { default: Elk } = await import("elkjs/lib/elk.bundled.js");
  return new Elk();
}

let runner: Promise<ElkRunner> | null = null;
let mainThread: Promise<ElkRunner> | null = null;

function mainThreadRunner(): Promise<ElkRunner> {
  mainThread ??= createMainThreadRunner();
  return mainThread;
}

/**
 * Lays `graph` out with ELK: in a worker where the environment has one, on the
 * main thread otherwise (tests, a worker that failed). The result is the same
 * either way — it is one ELK, run in a different thread.
 */
export async function runElk(graph: ElkNode): Promise<ElkNode> {
  runner ??=
    typeof Worker === "undefined"
      ? mainThreadRunner()
      : createWorkerRunner().catch((error: unknown) => {
          console.warn("[layout] ELK worker unavailable, laying out on the main thread", error);
          return mainThreadRunner();
        });
  const current = await runner;
  try {
    return await current.layout(graph);
  } catch (error) {
    // A layout ELK rejects fails the same on either thread; only a dead worker falls back.
    if (!(error instanceof ElkWorkerFailure)) throw error;
    const fallback = await mainThreadRunner();
    console.warn("[layout] ELK worker failed, laying out on the main thread", error);
    runner = Promise.resolve(fallback);
    return fallback.layout(graph);
  }
}
