import * as vscode from "vscode";
import { AppConfig, ContextToken } from "../common/types";

type MessageHandler<T, U> = (message: T) => Promise<U> | U;

interface MessageListeners {
  saveFile?: MessageHandler<SaveFileMessage, void>;
  readFile?: MessageHandler<ReadFileMessage, string>;
  getTokens?: MessageHandler<GetTokensMessage, {filename: string; tokens: string[]}>;
  getContext?: MessageHandler<GetContextMessage, ContextToken[]>;
  getConfig?: MessageHandler<GetConfigMessage, AppConfig>;
  signal?: MessageHandler<SignalMessage, void>;
}

export interface WebAppMessage {
  sender: "scout";
}

export interface GetTokensMessage extends WebAppMessage {
  type: "getTokens";
  data: { filename?: string }
}

export interface GetContextMessage extends WebAppMessage {
  type: "getContext";
}

export interface SaveFileMessage extends WebAppMessage {
  type: "saveFile";
  data: {
    filename: string;
    content: string;
  };
}

export interface ReadFileMessage extends WebAppMessage {
  type: "readFile";
  data: {
    filename: string;
  };
}

export interface GetConfigMessage extends WebAppMessage {
  type: "getConfig";
}

export interface SignalMessage extends WebAppMessage {
  type: "signal";
  data: string;
}

interface HostMessage {
  sender: "vscode";
  type: string; // keyof MessageListeners;
  data: any;
}

export default class WebAppView implements vscode.WebviewViewProvider {
  public static readonly viewType = "scout.webAppView";

  private _view?: vscode.WebviewView;
  private messageListeners: MessageListeners;
  private isClientReady: boolean;
  private readonly messageQueue: HostMessage[];

  constructor(private readonly _extensionUri: vscode.Uri) {
    this.messageListeners = {};
    this.isClientReady = false;
    this.messageQueue = [];
  }

  public async resolveWebviewView(webviewView: vscode.WebviewView) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this._extensionUri, "dist", "ui"),
      ],
    };

    webviewView.webview.onDidReceiveMessage(async (message) => {
      const msgType = message.type as keyof MessageListeners;
      if (msgType === "signal" && message.data === "ready") {
        this.isClientReady = true;
        this.messageQueue.forEach((message) =>
          this.sendMessage(message.type, message.data)
        );
      }
      const listener = this.messageListeners[msgType];
      if (listener) {
        const data = await listener(message);
        this.sendMessage(msgType, data);
      }
    });

    webviewView.webview.html = this.getHtml();
  }

  public set tokensMessageListener(
    listener: (message: GetTokensMessage) => Promise<{filename: string, tokens: string[]}>
  ) {
    this.messageListeners["getTokens"] = listener;
  }

  public set contextMessageListener(
    listener: (
      message: GetContextMessage
    ) => Promise<ContextToken[]> | ContextToken[]
  ) {
    this.messageListeners["getContext"] = listener;
  }

  public set configMessageListener(
    listener: (message: GetConfigMessage) => Promise<AppConfig> | AppConfig
  ) {
    this.messageListeners["getConfig"] = listener;
  }

  public set saveFileMessageListener(
    listener: (data: SaveFileMessage) => Promise<void> | void
  ) {
    this.messageListeners["saveFile"] = listener;
  }

  public set readFileMessageListener(
    listener: (message: ReadFileMessage) => Promise<string> | string
  ) {
    this.messageListeners["readFile"] = listener;
  }

  public sendMessage(type: string, data: any): void {
    const sender = "vscode" as "vscode";
    const message = { sender, type, data };
    if (
      !Object.keys(this.messageListeners).includes(type) &&
      !this.isClientReady
    ) {
      // We are sending the message so we need to wait for the app to signal that it is ready.
      this.messageQueue.push(message);
    } else {
      this._view?.webview.postMessage(message);
    }
  }

  private getHtml() {
    const nonce = WebAppView.getNonce();

    return `
        <!DOCTYPE html>
        <html lang="en">
          <head>
          <meta charset="utf-8" />
          <!--meta
            http-equiv="Content-Security-Policy"
            content="
            default-src 'none';
            https:; 
            img-src ${this._view?.webview.cspSource};
            script-src ${this._view?.webview.cspSource} 'nonce-${nonce}';
            style-src ${this._view?.webview.cspSource}; 
            font-src ${this._view?.webview.cspSource};"
          /-->
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Roboto:100,300,400,500,700,900">
          <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@mdi/font@latest/css/materialdesignicons.min.css">
          <link rel="stylesheet" href="${this.getUri("dist/ui/css/app.css")}">
          <link rel="stylesheet" href="${this.getUri(
            "dist/ui/css/chunk-vendors.css"
          )}">
          <title>Scout</title>
          </head>
          <body style="padding: 0;">
            <div id="app"></div>
            <script
              src="${this.getUri("dist/ui/js/chunk-vendors.js")}"
              nonce="${nonce}"
            ></script>  
            <script
              src="${this.getUri("dist/ui/js/app.js")}"
              nonce="${nonce}"
            ></script>
          </body>
        </html> 
    `;
  }

  private static getNonce(): string {
    let text = "";
    const possible =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

  private getUri(path: string): vscode.Uri | undefined {
    const pathSegments = path.split("/");
    return this._view?.webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, ...pathSegments)
    );
  }
}
