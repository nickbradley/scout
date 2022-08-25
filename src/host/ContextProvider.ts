import {
  // CallToken,
  ContextToken,
  TokenKind
  // LanguageToken,
  // LibraryToken,
} from "../common/types";
import * as ts from "typescript";
import * as vscode from "vscode";

export default class ContextProvider {
  private tokens: ContextToken[];
  private readonly decorationType: vscode.TextEditorDecorationType;

  constructor(readonly editor: vscode.TextEditor, decorationOptions?: vscode.DecorationRenderOptions) {
    this.tokens = [];

    this.decorationType = decorationOptions
      ? vscode.window.createTextEditorDecorationType(decorationOptions)
      : vscode.window.createTextEditorDecorationType({
        backgroundColor: "green"
      });
  }

  public decorateTokens(tokens: ContextToken[]): void {
    const rangeOptions = tokens.map((token) => {
      const startPos = this.editor.document.positionAt(token.position.start);
      const endPos = this.editor.document.positionAt(token.position.end);
      return { range: new vscode.Range(startPos, endPos) };
    });
    console.log("RANGE", rangeOptions);
    console.log("DECORATION_TYPE", this.decorationType);
    this.editor.setDecorations(this.decorationType, rangeOptions);
  }

  public decorateToken(token: ContextToken): void {
    this.decorateTokens([token]);
  }

  public decorateAllTokens(): void {
    this.decorateTokens(this.tokens);
  }

  public undecorateTokens(tokens: ContextToken[]): void {
    this.decorateTokens(this.tokens.filter((token) => !tokens.find((tkn) => ContextProvider.tokensEqual(token, tkn))));
  }

  public undecorateToken(token: ContextToken): void {
    this.undecorateTokens(this.tokens.filter((tkn) => !ContextProvider.tokensEqual(token, tkn)));
  }

  public undecorateAllTokens(): void {
    this.decorateTokens([]);
  }

  public static tokensEqual(a: ContextToken, b: ContextToken): boolean {
    return a.position.start === b.position.start && a.position.end === b.position.end;
  }


  public parse(): ContextToken[] {
    // TODO create selection based on active line
    // const selection = new vscode.Selection();
    // this.tokens = this.getTokensInSelection(selection);
    const position = this.editor.selection.active;
    const sourceText = this.editor.document.getText();
    this.tokens = this.getContext(sourceText, this.editor.document.offsetAt(position));
    return this.tokens;
  }
  // public getTokensInSelection(selection: vscode.Selection): ContextToken[] {
  //   throw new Error("Not implemented.");
  // }



  public getContext(sourceText: string, cursorPos: number): ContextToken[] {
    const context = {
      language: { value: "javascript", kind: TokenKind.language, position: { start: -1, end: -1 } },
      libraries: [] as ContextToken[],
      externalCalls: [] as ContextToken[],
    };
    const imports: string[] = [];
    const derived: string[] = [];
    let activeMethodBlock: ts.Node | undefined;
    // let sawScopedBlock = false;
    let ignoreFunctionBlocks = false;

    const sourceFile = ts.createSourceFile(
      "",
      sourceText,
      ts.ScriptTarget.ES2021,
      true
    );
    findNodeContext(sourceFile);

    function findNodeContext(node: ts.Node) {
      switch (node.kind) {
        case ts.SyntaxKind.ImportDeclaration: {
          const importNode = node as ts.ImportDeclaration;
          const libName = (importNode.moduleSpecifier as any).text as string;
          if (!libName.startsWith(".") && !libName.startsWith("@/")) {
            const pos = importNode.pos;
            const end = importNode.end;
            context.libraries.push({ value: libName, kind: TokenKind.library, position: { start: pos, end } });

            if (importNode.importClause?.name) {
              // default import
              imports.push(importNode.importClause.name.escapedText as string);
            } else if (importNode.importClause?.namedBindings) {
              // multi-import
              if (
                importNode.importClause?.namedBindings.kind ===
                ts.SyntaxKind.NamedImports
              ) {
                for (const specifier of importNode.importClause?.namedBindings
                  ?.elements) {
                  imports.push(specifier.name.escapedText as string);
                }
              }
            }

            const importName = importNode.importClause?.name
              ?.escapedText as string;
            if (importName) {
              imports.push(importName);
            }
            // if (libName) {}
          }
          break;
        }
        case ts.SyntaxKind.FunctionDeclaration:
        case ts.SyntaxKind.MethodDeclaration:
        case ts.SyntaxKind.ArrowFunction:
        case ts.SyntaxKind.Constructor:
          // sawScopedBlock = true;
          if (node.parent.kind !== ts.SyntaxKind.ObjectLiteralExpression) {
            // handle parser.js
            const methodNode = node as ts.MethodDeclaration;
            if (methodNode.pos <= cursorPos && methodNode.end >= cursorPos) {
              activeMethodBlock = methodNode.body;
            }
          }
          break;
      }

      if (!activeMethodBlock) {
        ts.forEachChild(node, findNodeContext);
      }
    }

    if (!activeMethodBlock) {
      activeMethodBlock = sourceFile;
      ignoreFunctionBlocks = true;
    }

    function findDerivativeContext(node: ts.Node) {
      switch (node.kind) {
        case ts.SyntaxKind.VariableDeclaration: {
          const declaration = node as ts.VariableDeclaration;
          if (declaration.initializer?.kind === ts.SyntaxKind.NewExpression) {
            const importName = imports.find(
              (imp) =>
                imp === (declaration.initializer as any).expression.escapedText
            );
            if (importName) {
              if (declaration.name.kind === ts.SyntaxKind.Identifier) {
                derived.push(declaration.name.escapedText as string);

                context.externalCalls.push({ value: importName, kind: TokenKind.call, position: { start: declaration.name.pos, end: declaration.name.end } });
              }
            }
            // for (const importName of imports) {
            //   if (declaration.getText().includes(importName)) {
            //     if (declaration.name.kind === ts.SyntaxKind.Identifier) {
            //       derived.push(declaration.name.escapedText as string);
            //     }
            //   }
            // }
          }
        }
      }

      ts.forEachChild(node, findDerivativeContext);
    }
    findDerivativeContext(sourceFile);

    let acc: ContextToken[] = [];

    function findCallContext(node: ts.Node) {
      // We are descending into a function but the cursor is outside all functions; don't process
      if (
        ignoreFunctionBlocks &&
        [
          ts.SyntaxKind.FunctionDeclaration,
          ts.SyntaxKind.MethodDeclaration,
          ts.SyntaxKind.ArrowFunction,
          ts.SyntaxKind.Constructor,
        ].includes(node.kind)
      ) {
        return;
      }

      if (node.kind === ts.SyntaxKind.PropertyAccessExpression) {
        const property = node as ts.PropertyAccessExpression;
        if (property.name.kind === ts.SyntaxKind.Identifier) {
          // console.log((property.name as any).escapedText);
          acc.push({
            value: (property.name as any).escapedText,
            kind: TokenKind.call,
            position: { start: property.name.pos, end: property.name.end }
          });
        }
        if (property.expression.kind === ts.SyntaxKind.Identifier) {
          // console.log((property.expression as any).escapedText);
          acc.push({
            value: (property.expression as any).escapedText,
            kind: TokenKind.call,
            position: { start: property.expression.pos, end: property.expression.end }
          });
        }
      } else if (
        node.kind === ts.SyntaxKind.CallExpression &&
        node.parent.kind === ts.SyntaxKind.PropertyAccessExpression
      ) {
        // do nothing
      } else if (node.kind === ts.SyntaxKind.CallExpression) {
        const call = node as ts.CallExpression;
        if (call.expression.kind === ts.SyntaxKind.Identifier) {
          const callName = (call.expression as any).escapedText;
          if (imports.includes(callName) || derived.includes(callName)) {
            context.externalCalls.push({
              value: callName,
              kind: TokenKind.call,
              position: { start: call.expression.pos, end: call.expression.end }
            });
          }
        } else if (
          call.expression.kind === ts.SyntaxKind.PropertyAccessExpression
        ) {
          const callName = (call.expression as any).expression.escapedText;
          const name = (call.expression as any).name.escapedText as string;
          if (imports.includes(callName) || derived.includes(callName)) {
            context.externalCalls.push({
              value: name,
              kind: TokenKind.call,
              position: { start: (call.expression as any).name.pos, end: (call.expression as any).name.end }
            });
          }
        }
      } else {
        if (acc.length > 0) {
          const importName = acc[acc.length - 1];
          if (imports.includes(importName.value) || derived.includes(importName.value)) {
            context.externalCalls.push(
              ...acc.slice(0, acc.length - 1).reverse()
            );
          }
          // if (imports.includes(acc[acc.length - 1])) {
          //   context.externalCalls.push(acc.reverse().join("."));
          // }
        }
        acc = [];
      }
      ts.forEachChild(node, findCallContext);
    }

    if (activeMethodBlock) {
      findCallContext(activeMethodBlock);
    }

    // const language: LanguageToken = {
    //   kind: "language",
    //   value: context.language,
    // };
    // const libraries: LibraryToken[] = [...new Set(context.libraries)].map(
    //   (libName) => ({
    //     kind: "library",
    //     value: libName,
    //     typings: [],
    //     docSites: [],
    //   })
    // );
    // const calls: CallToken[] = [...new Set(context.externalCalls)].map(
    //   (callName) => ({ kind: "call", value: callName })
    // );

    // return [language, ...libraries, ...calls];
    return [context.language, ...context.libraries, ...context.externalCalls];
  }
}
