import * as vscode from "vscode";
import ContextProvider from "./ContextProvider";
import NodeModule from "./NodeModule";
import WebAppView, { SaveFileMessage, ReadFileMessage } from "./WebAppView";
import { ContextToken, LibraryToken } from "../common/types";
import Util from "./Util";

export async function activate(context: vscode.ExtensionContext) {
  // eslint-disable-next-line no-undef
  let searchApiToken = process.env.SEARCH_API_TOKEN;
  if (!searchApiToken) {
    searchApiToken = await context.secrets.get("SEARCH_API_TOKEN");
  }
  if (!searchApiToken) {
    searchApiToken = await vscode.window.showInputBox({
      title: "Search API Token",
      prompt: "Please provide your Serp API token.",
    });
  }
  if (!searchApiToken) {
    vscode.window.showErrorMessage(
      "Serp API token has not been configured. You will not be able to make searches until you add the token."
    );
  } else {
    await context.secrets.store("SEARCH_API_TOKEN", searchApiToken);
  }

  const provider = new WebAppView(context.extensionUri);

  provider.contextMessageListener = async () => {
    let contextTokens: ContextToken[] = [];
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      const position = editor.selection.active;
      const input = editor?.document.getText() || "";
      try {
        contextTokens = new ContextProvider().getContext(
          input,
          editor.document.offsetAt(position)
        );
        const libTokens = contextTokens.filter(
          (token): token is LibraryToken => token.kind === "library"
        );
        for (const libToken of libTokens) {
          libToken.docSites =
            (await new NodeModule(libToken.value).getDocumentationSites()) ??
            [];
        }

        // const libProps = await Promise.allSettled(
        //   libTokens.map((token) =>
        //     new NodeModule(token.value).getDocumentationSites()
        //   )
        // );
        // libTokens.forEach((token, i) =>
        //   Object.assign(token, {
        //     docsUrl: Util.isFulfilled(libProps[i])
        //       ? libProps[i].value
        //       : [],
        //   })
        // );
      } catch (err) {
        // Parser failed (probably not a JS file)
        console.warn(
          "Failed to extract context tokens from",
          editor.document.uri.fsPath,
          err
        );
      }
    }
    return contextTokens;
  };

  provider.saveFileMessageListener = async (message: SaveFileMessage) => {
    const filename = message.data.filename;
    const content = message.data.content;
    await Util.writeWorkspaceFile(filename, content);
  };

  provider.readFileMessageListener = async (message: ReadFileMessage) => {
    const filename = message.data.filename;
    return Util.readWorkspaceFile(filename);
  };

  provider.configMessageListener = async () => {
    // TODO check env for config values first
    const config = {}; //JSON.parse(
      // await Util.readWorkspaceFile("scout.config.json")
    //);
    return Object.assign(config, { serpApiToken: searchApiToken as string });
    // const keys = await import("../common/secrets");
    // return {
    //   bingApiToken: keys.bingApiToken,
    //   serpApiToken: keys.serpApiToken,
    //   studyMode: "treatment",
    // };
  };

  const webAppDisposable = vscode.window.registerWebviewViewProvider(
    WebAppView.viewType,
    provider,
    {
      webviewOptions: { retainContextWhenHidden: true },
    }
  );
  context.subscriptions.push(webAppDisposable);

  const commandDisposable = vscode.commands.registerCommand(
    "scout.search",
    async (searchQuery: string) => {
      if (searchQuery) {
        provider.sendMessage("search", searchQuery);
      }
      await vscode.commands.executeCommand("workbench.view.extension.scout");
    }
  );
  context.subscriptions.push(commandDisposable);
}

// this method is called when your extension is deactivated
export function deactivate() {}
