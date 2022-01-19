import CodeContext from "@/CodeContext";
import { WebviewApi } from "vscode-webview";
import { AppConfig, ContextToken } from "../../common/types";

export interface HostServiceProvider {
  saveFile: (filename: string, content: string) => Promise<void>;
  readFile: (filename: string) => Promise<string>;
  getContext: (mockContext?: CodeContext) => Promise<CodeContext>;
  getTokens: (
    filename?: string
  ) => Promise<{ filename: string; tokens: string[] }>;
  getConfig: () => Promise<AppConfig>;
  signalReady: () => void;
}

interface VsCodeMessage {
  sender: "vscode" | "scout";
  type: string;
  data?: unknown;
  error?: Error;
}

interface DispatchListener {
  messageType: string;
  resolve: (data?: any) => void;
  reject: (error: Error) => void;
}

export class VsCodeHost implements HostServiceProvider {
  dispatchQueue: DispatchListener[] = [];

  constructor(readonly vscode: WebviewApi<null>) {
    window.addEventListener("message", (event) => {
      const message = event.data as VsCodeMessage;
      if (message.sender === "vscode") {
        const listenerIndex = this.dispatchQueue.findIndex(
          (listener) => listener.messageType === message.type
        );
        if (listenerIndex >= 0) {
          const listener = this.dispatchQueue.splice(listenerIndex, 1)[0];
          if (message.error) {
            // TODO this might need to be listener.reject(new Error(message.error)) depending on serialization
            listener.reject(message.error);
          } else {
            listener.resolve(message.data);
          }
        }
      }
    });
  }

  public signalReady(): void {
    this.vscode.postMessage({ sender: "scout", type: "signal", data: "ready" });
  }

  public async saveFile(filename: string, content: string): Promise<void> {
    const listener = (resolve: () => void, reject: (error: Error) => void) => {
      this.dispatchQueue.push({ messageType: "saveFile", resolve, reject });
    };
    const replyPromise = new Promise<void>(listener);
    const message: VsCodeMessage = {
      sender: "scout",
      type: "saveFile",
      data: { filename, content },
    };
    this.vscode.postMessage(message);
    return replyPromise;
  }

  public async readFile(filename: string): Promise<string> {
    const listener = (
      resolve: (data: string) => void,
      reject: (error: Error) => void
    ) => {
      this.dispatchQueue.push({ messageType: "readFile", resolve, reject });
    };
    const replyPromise = new Promise<string>(listener);
    const message: VsCodeMessage = {
      sender: "scout",
      type: "readFile",
      data: { filename },
    };
    this.vscode.postMessage(message);
    return replyPromise;
  }

  public async getContext(): Promise<CodeContext> {
    const listener = (
      resolve: (codeContext: CodeContext) => void,
      reject: (error: Error) => void
    ) => {
      const mapper = (contextTokens: ContextToken[]) =>
        resolve(new CodeContext(contextTokens));
      this.dispatchQueue.push({
        messageType: "getContext",
        resolve: mapper,
        reject,
      });
    };
    const replyPromise = new Promise<CodeContext>(listener);
    const message: VsCodeMessage = {
      sender: "scout",
      type: "getContext",
    };
    this.vscode.postMessage(message);
    return replyPromise;
  }

  public async getTokens(
    filename?: string
  ): Promise<{ filename: string; tokens: string[] }> {
    const listener = (
      resolve: (data: { filename: string; tokens: string[] }) => void,
      reject: (error: Error) => void
    ) => {
      this.dispatchQueue.push({
        messageType: "getTokens",
        resolve,
        reject,
      });
    };
    const replyPromise = new Promise<{ filename: string; tokens: string[] }>(
      listener
    );
    const message: VsCodeMessage = {
      sender: "scout",
      type: "getTokens",
      data: { filename },
    };
    this.vscode.postMessage(message);
    return replyPromise;
  }

  public async getConfig(): Promise<AppConfig> {
    const listener = (
      resolve: (data: AppConfig) => void,
      reject: (error: Error) => void
    ) => {
      this.dispatchQueue.push({ messageType: "getConfig", resolve, reject });
    };
    const replyPromise = new Promise<AppConfig>(listener);
    const message: VsCodeMessage = {
      sender: "scout",
      type: "getConfig",
    };
    this.vscode.postMessage(message);
    return replyPromise;
  }
}

export class MockHost implements HostServiceProvider {
  private savedFiles: { [filename: string]: string } = {};

  public signalReady(): void {
    return;
  }

  public async saveFile(filename: string, content: string): Promise<void> {
    this.savedFiles[filename] = content;
    return Promise.resolve();
  }

  public async readFile(filename: string): Promise<string> {
    const content = this.savedFiles[filename];
    if (!content) {
      throw new Error("File not found.");
    }
    return content;
  }

  public async getContext(mockContext?: CodeContext): Promise<CodeContext> {
    if (mockContext) {
      return mockContext;
    } else {
      const task0: ContextToken[] = [
        { value: "javascript", kind: "language" },
        { value: "bcrypt", kind: "library", docSites: [], typings: [] },
        {
          value: "mongodb",
          kind: "library",
          docSites: ["docs.mongodb.com"],
          typings: [],
        },
      ];
      const task1: ContextToken[] = [
        { value: "javascript", kind: "language" },
        { value: "JSZip", kind: "library", docSites: [], typings: [] },
      ];

      return new CodeContext(task0);
    }
  }

  public async getTokens(): Promise<{ filename: string; tokens: string[] }> {
    throw new Error("Not implemented");
  }
  public async getConfig(mockConfig?: AppConfig): Promise<AppConfig> {
    if (mockConfig) {
      return mockConfig;
    } else {
      console.log("ENV", process.env);
      const searchApiToken = process.env.SEARCH_API_TOKEN;
      // const keys = await import("../../common/secrets");
      return {
        // bingApiToken: "",
        serpApiToken: searchApiToken,
        // studyMode: "treatment",
      };
    }
  }
}
