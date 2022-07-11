enum Status {
  Idle,
  Active,
  Disposed,
}

export default class WebWorker<T, U> extends globalThis.Worker {
  private _status: Status;

  constructor(readonly scriptURL: string) {
    super(scriptURL);
    this._status = Status.Idle;
  }

  public get status(): Status {
    return this._status;
  }

  public async run(data: T): Promise<U> {
    if (this._status === Status.Disposed) {
      throw new Error("Worker has been disposed.");
    }
    this._status = Status.Active;
    this.postMessage(data);
    return new Promise<U>((resolve, reject) => {
      this._status = Status.Idle;
      this.onerror = reject;
      this.onmessageerror = reject;
      this.onmessage = (e) => resolve(e.data);
    });
  }

  public destroy(): void {
    this._status = Status.Disposed;
    this.terminate();
  }
}
