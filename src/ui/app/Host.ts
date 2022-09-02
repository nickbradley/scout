import CodeContext from "../../common/CodeContext";
import { WebviewApi } from "vscode-webview";
import {
  AppConfig,
  CodeToken,
  ContextToken,
  StackOverflowCallSignature,
} from "../../common/types";

export interface HostServiceProvider {
  saveFile: (filename: string, content: string) => Promise<void>;
  readFile: (filename: string) => Promise<string>;
  getContext: (mockContext?: CodeContext) => Promise<CodeContext>;
  getTokens: (
    filename?: string
  ) => Promise<{ filename: string; tokens: string[] }>;
  getConfig: () => Promise<AppConfig>;
  signalReady: () => void;
  decorate: (
    codeTokens: Array<CodeToken & { decorationOptions: Record<string, string> }>
  ) => Promise<void>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MessageData = any;

interface VsCodeMessage {
  sender: "vscode" | "scout";
  type: string;
  messageId?: string;
  data?: unknown;
  error?: Error;
}

interface DispatchListener {
  messageType: string;
  messageId?: string;
  resolve: (data?: MessageData) => void;
  reject: (error: Error) => void;
}

export class VsCodeHost implements HostServiceProvider {
  dispatchQueue: DispatchListener[] = [];

  constructor(readonly vscode: WebviewApi<null>) {
    window.addEventListener("message", (event) => {
      const message = event.data as VsCodeMessage;
      if (message.sender === "vscode") {
        const listenerIndex = this.dispatchQueue.findIndex(
          (listener) =>
            message.messageId === listener.messageId &&
            listener.messageType === message.type
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

  private sendMessage(
    type: string,
    responseHandler: (data?: MessageData) => void,
    errorHandler: (error: Error) => void,
    data?: MessageData
  ) {
    const messageId = Math.round(Math.random() * 100000).toString();
    this.dispatchQueue.push({
      messageType: type,
      messageId,
      resolve: responseHandler,
      reject: errorHandler,
    });
    const message: VsCodeMessage = {
      sender: "scout",
      messageId,
      type,
      data,
    };
    this.vscode.postMessage(message);
  }

  public signalReady(): void {
    this.vscode.postMessage({ sender: "scout", type: "signal", data: "ready" });
  }

  public async saveFile(filename: string, content: string): Promise<void> {
    const listener = (resolve: () => void, reject: (error: Error) => void) => {
      this.sendMessage("saveFile", resolve, reject, { filename, content });
    };
    return new Promise<void>(listener);
  }

  public async readFile(filename: string): Promise<string> {
    const listener = (
      resolve: (data: string) => void,
      reject: (error: Error) => void
    ) => {
      this.sendMessage("readFile", resolve, reject, {
        filename,
      });
    };
    return new Promise<string>(listener);
  }

  public async getContext(): Promise<CodeContext> {
    const listener = (
      resolve: (codeContext: CodeContext) => void,
      reject: (error: Error) => void
    ) => {
      const mapper = (contextTokens: ContextToken[]) =>
        resolve(new CodeContext(contextTokens));
      this.sendMessage("getContext", mapper, reject);
    };
    return new Promise<CodeContext>(listener);
  }

  public async decorate(
    codeTokens: Array<CodeToken & { decorationOptions: Record<string, string> }>
  ): Promise<void> {
    const listener = (resolve: () => void, reject: (error: Error) => void) => {
      this.sendMessage("decorate", resolve, reject, { codeTokens });
    };
    return new Promise<void>(listener);
  }

  public async getSignatures(
    url: string,
    keywords: string[]
  ): Promise<StackOverflowCallSignature[]> {
    const listener = (
      resolve: (signature: StackOverflowCallSignature[]) => void,
      reject: (error: Error) => void
    ) => {
      const mapper = (signatures: StackOverflowCallSignature[]) =>
        resolve(
          signatures.map((sig) => {
            if (sig.lastModified) {
              return { ...sig, lastModified: new Date(sig.lastModified) };
            } else {
              return sig;
            }
          })
        );

      this.sendMessage("getSignatures", mapper, reject, { url, keywords });
    };
    return new Promise<StackOverflowCallSignature[]>(listener);
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
      this.sendMessage("getConfig", resolve, reject);
    };
    return new Promise<AppConfig>(listener);
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
    }
    return new CodeContext();
  }

  public async decorate(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    codeTokens: Array<CodeToken & { decorationOptions: Record<string, string> }>
  ): Promise<void> {
    return;
  }

  public async getTokens(): Promise<{ filename: string; tokens: string[] }> {
    throw new Error("Not implemented");
  }
  public async getConfig(mockConfig?: AppConfig): Promise<AppConfig> {
    if (mockConfig) {
      return mockConfig;
    } else {
      console.log("ENV", process.env);
      const searchApiToken = process.env.SEARCH_API_TOKEN ?? "";
      // const keys = await import("../../common/secrets");
      return {
        // bingApiToken: "",
        serpApiToken: searchApiToken,
        // studyMode: "treatment",
      };
    }
  }
}
