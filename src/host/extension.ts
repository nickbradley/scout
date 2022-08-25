import * as vscode from "vscode";
// import NodeModule from "./NodeModule";
import WebAppView, { SaveFileMessage, ReadFileMessage, GetTokensMessage, DecorateCodeTokensMessage } from "./WebAppView";
import { CodeToken, TokenPosition } from "../common/types";
import Util from "./Util";
import Lexer from "./Lexer";
import { CodeBlock } from "../common/CodeBlock";

export async function activate(context: vscode.ExtensionContext) {
  const activeDecorations: vscode.TextEditorDecorationType[] = [];
  
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

  provider.tokensMessageListener = async (msg: GetTokensMessage) => {
    let tokens: string[] = [];
    let sourceText = "";
    let filename = "";

    if (msg.data?.filename) {
      filename = msg.data.filename;
      sourceText = await Util.readWorkspaceFile(filename);
    } else {
      const editor = vscode.window.activeTextEditor;
      filename = editor?.document.uri.fsPath ?? "";
      sourceText = editor?.document.getText() ?? "";
    }

    try {
      const lexer = new Lexer();
      tokens = lexer.parse(sourceText);
    } catch (err) {
      console.warn(`Failed to tokenize ${filename}`, err);
    }

    return { filename, tokens };
  };

  provider.contextMessageListener = async () => {
    let filename: string;
    const codeTokens: CodeToken[] = [];
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      filename = editor.document.fileName;
      const position = editor.selection.active;
      const code = new CodeBlock(editor.document.getText(), filename);
      // Get the function containing position
      const activeFunction = code.getFunctions().find(fn => {
        const startPosition = new vscode.Position(fn.getStartLineNumber(true), fn.getStartLinePos(true));
        const endPosition = editor.document.positionAt(fn.getEnd());
        const fnRange = new vscode.Range(startPosition, endPosition);
        return fnRange.contains(position);
      });
      if (activeFunction) {
        const imports = code.getImports();
        // Only include external imports which are referenced in the active function
        const importTokens = imports
            .flatMap(imp => code.getImportTokens(imp))
            .filter(token => !token.module.name.includes("/"))
            .filter(token => token.references.some(ref => activeFunction.containsRange(ref?.start ?? -1 , ref?.end ?? -1)));
            // .map(token => ({ ...token, source: filename }));
        const functionTokens = code.getFunctionTypes(activeFunction); // { ...code.getFunctionTypes(activeFunction), source: filename };
        codeTokens.push(...importTokens, functionTokens);
      }
    }
    return codeTokens;
  };

  provider.decorateCodeTokensMessageListener = (message: DecorateCodeTokensMessage) => {
    const tokens = message.data.codeTokens;

    if (tokens === null) {
      return activeDecorations.forEach((decoration) => decoration.dispose());
    }

    // partition by sources    
    const sourceTokens: {[source: string]: Array<CodeToken & { decorationOptions: vscode.DecorationRenderOptions }>} = {};
    for (const token of tokens) {
      const source = token.source;
      if (!source) {
        continue;
      }

      if (!sourceTokens[source]) {
        sourceTokens[source] = [];
      }
      sourceTokens[source].push(token);
    }

    for (const [source, tokens] of Object.entries(sourceTokens)) {
      const editor = vscode.window.visibleTextEditors.find(editor => editor.document.fileName.endsWith(source));
      if (!editor) {
        continue;
      }

      const decorations: Array<{options: any, range: vscode.Range}> = [];
      tokens
      .filter((token): token is {name: string; position: TokenPosition; source: string, decorationOptions: vscode.DecorationRenderOptions } => token.position !== undefined)
      .sort((a, b) => b.position.start - a.position.start)
      .map(token => {
        const startPos = editor.document.positionAt(token.position.start);
        const endPos = editor.document.positionAt(token.position.end);

        const range = new vscode.Range(startPos, endPos);
        return {...token, range};
      }).forEach((token) => {
        const rangeDecoration = decorations.find((dec) => token.range.isEqual(dec.range));

        if (rangeDecoration) {
          const bkColor = (token as any).decorationOptions.backgroundColor;
          const bkColorOption = rangeDecoration.options.backgroundColor;
            if (bkColor !== bkColorOption) {
              // update options for the range to use a linear gradient
            }
        } else {
          decorations.push({
            options: (token as any).decorationOptions,
            range: token.range,
          });
        }
      });

      for (const decoration of decorations) {
        const decorationType = vscode.window.createTextEditorDecorationType(decoration.options);
        activeDecorations.push(decorationType);
        const rangeOptions = [decoration.range];
        editor.setDecorations(decorationType, rangeOptions);
      }
    }
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
    const config = {};
    return Object.assign(config, { serpApiToken: searchApiToken as string });
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
