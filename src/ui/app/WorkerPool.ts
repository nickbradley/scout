import WebWorker from "@/WebWorker";
import { CancellationToken } from "../../common/types";

type Worker<T, U> = WebWorker<T, U> & { isAcquired: boolean; destroy: never };

export default class WorkerPool<T, U> {
  private readonly workers: Worker<T, U>[];
  private readonly queue: Array<
    (value: Worker<T, U> | PromiseLike<Worker<T, U>>) => void
  >;

  constructor(readonly scriptURL: string, readonly maxWorkers?: number) {
    const logicalCores = navigator.hardwareConcurrency;
    if (maxWorkers && maxWorkers > logicalCores) {
      console.warn(
        "Number of workers exceeds hardware cores. This could negaitively affect performance."
      );
    } else if (!maxWorkers) {
      maxWorkers = Math.max(logicalCores - 2, 0) || 2;
    }
    this.maxWorkers = maxWorkers;
    this.queue = [];
    this.workers = new Array(maxWorkers);
    for (let i = 0; i < maxWorkers; i++) {
      const worker = Object.assign(new WebWorker<T, U>(scriptURL), {
        isAcquired: false,
      });
      this.workers[i] = worker;
    }
  }

  get maxWorkerCount(): number {
    return this.maxWorkers || 0;
  }

  public async acquireWorker(token: CancellationToken): Promise<Worker<T, U>> {
    const acquiredWorker = this.workers.find((worker) => !worker.isAcquired);
    if (acquiredWorker) {
      acquiredWorker.isAcquired = true;
      return acquiredWorker;
    } else {
      return new Promise<Worker<T, U>>((resolve, reject) => {
        this.queue.push(resolve);
        token.cancel = () => {
          const idx = this.queue.findIndex((resolver) => resolver === resolve);
          if (idx >= 0) {
            this.queue.splice(idx, 1);
          }
          reject(new Error("Worker acquisition canceled by user."));
        };
      });
    }
  }

  public releaseWorker(worker: Worker<T, U>): void {
    const resolve = this.queue.shift();
    if (!worker.isIdle) {
      worker.reinit();
    }
    if (resolve) {
      worker.isAcquired = false;
      resolve(worker);
    }
  }

  public dispose(): void {
    this.workers.forEach((worker) => worker.destroy());
    // Clear queue of pending request (jobs waiting for a worker should receive an error that the worker has already been disposed).
    this.queue.forEach((pendingWorkerRequest) =>
      pendingWorkerRequest(this.workers[0])
    );
  }
}
