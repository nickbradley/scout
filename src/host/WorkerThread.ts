import {Worker} from "worker_threads";

enum Status {
  idle,
  active,
  disposed,
}

export default class WebWorker<T, U> {
  private _status!: Status;
  private _worker!: Worker;
  private _abortController!: AbortController;

  constructor(readonly scriptURL: string) {
    this.init();
  }

  public get status(): Status {
    return this._status;
  }

  public get isActive(): boolean {
    return this._status === Status.active;
  }

  public get isIdle(): boolean {
    return this._status === Status.idle;
  }

  public async run(data: T): Promise<U> {
    if (this._status !== Status.idle) {
      throw new Error("Worker is not available.");
    }
    this._status = Status.active;
    return new Promise<U>((resolve, reject) => {
      const onAbort = () => {
        reject(new Error("Worker canceled by user."));
      };
      this._abortController.signal.addEventListener("abort", onAbort, {
        once: true,
      });

      this._status = Status.idle;
      this._worker.on("error", (e) => {
        this._abortController.signal.removeEventListener("abort", onAbort);
        reject(e);
      });
      this._worker.on("messageerror", (e) => {
        this._abortController.signal.removeEventListener("abort", onAbort);
        reject(e);
      });
      this._worker.on("message", (e) => {
        this._abortController.signal.removeEventListener("abort", onAbort);
        resolve(e);
      });
      this._worker.postMessage(data);
    });
  }

  public cancel(): void {
    this.reinit();
  }

  public destroy(): void {
    this._status = Status.disposed;
    this._worker.terminate();
  }

  public reinit(): void {
    this._abortController.abort();
    this.destroy();
    this.init();
  }

  private init(): void {
    this._worker = new Worker(this.scriptURL);
    this._abortController = new AbortController();
    this._status = Status.idle;
  }
}
