import {
  CallToken,
  ContextToken,
  LanguageToken,
  LibraryToken,
} from "../common/types";
import * as ts from "typescript";

export default class ContextProvider {
  public getContext(sourceText: string, cursorPos: number): ContextToken[] {
    const context = {
      language: "javascript",
      libraries: [] as string[],
      externalCalls: [] as string[],
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
            context.libraries.push(libName);

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
                context.externalCalls.push(importName);
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

    let acc: string[] = [];

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
          acc.push((property.name as any).escapedText);
        }
        if (property.expression.kind === ts.SyntaxKind.Identifier) {
          // console.log((property.expression as any).escapedText);
          acc.push((property.expression as any).escapedText);
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
            context.externalCalls.push(callName);
          }
        } else if (
          call.expression.kind === ts.SyntaxKind.PropertyAccessExpression
        ) {
          const callName = (call.expression as any).expression.escapedText;
          const name = (call.expression as any).name.escapedText as string;
          if (imports.includes(callName) || derived.includes(callName)) {
            context.externalCalls.push(name);
          }
        }
      } else {
        if (acc.length > 0) {
          const importName = acc[acc.length - 1];
          if (imports.includes(importName) || derived.includes(importName)) {
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

    const language: LanguageToken = {
      kind: "language",
      value: context.language,
    };
    const libraries: LibraryToken[] = [...new Set(context.libraries)].map(
      (libName) => ({
        kind: "library",
        value: libName,
        typings: [],
        docSites: [],
      })
    );
    const calls: CallToken[] = [...new Set(context.externalCalls)].map(
      (callName) => ({ kind: "call", value: callName })
    );

    return [language, ...libraries, ...calls];
  }
}
