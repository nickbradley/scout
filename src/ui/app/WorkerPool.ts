import WebWorker from "@/WebWorker";

type Worker<T, U> = WebWorker<T, U> & { isAcquired: boolean };

export default class WorkerPool<T, U> {
  private readonly workers: Worker<T, U>[];
  private readonly queue: Array<
    (value: Worker<T, U> | PromiseLike<Worker<T, U>>) => void
  >;

  constructor(readonly scriptURL: string, readonly maxWorkers = 2) {
    this.queue = [];
    this.workers = new Array(maxWorkers);
    for (let i = 0; i < maxWorkers; i++) {
      const worker = Object.assign(new WebWorker<T, U>(scriptURL), {
        isAcquired: false,
      });
      this.workers[i] = worker;
    }
  }

  public async acquireWorker(): Promise<Worker<T, U>> {
    const acquiredWorker = this.workers.find((worker) => !worker.isAcquired);
    if (acquiredWorker) {
      acquiredWorker.isAcquired = true;
      return acquiredWorker;
    } else {
      return new Promise<Worker<T, U>>((resolve) => this.queue.push(resolve));
    }
  }

  public releaseWorker(worker: Worker<T, U>): void {
    const resolve = this.queue.shift();
    if (resolve) {
      worker.isAcquired = false;
      resolve(worker);
    }
  }

  public dispose(): void {
    this.workers.forEach((worker) => worker.terminate());
    // Clear queue of pending request (jobs waiting for a worker should receive an error that the worker has already been disposed).
    this.queue.forEach((pendingWorkerRequest) =>
      pendingWorkerRequest(this.workers[0])
    );
  }
}
