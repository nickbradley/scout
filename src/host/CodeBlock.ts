import {
  Project,
  Node,
  SourceFile,
  CallExpression,
  Diagnostic,
  JSDoc,
  JSDocTag,
  JSDocParameterTag,
  Type,
  Identifier,
  FunctionDeclaration,
  ImportDeclaration,
  ScriptTarget,
  SyntaxKind,
} from "ts-morph";
import { CallSignature, CodeToken, FunctionToken, ImportToken, TokenPosition } from "../types";

export interface IsCodeAnnotation {
  value: string;
}

export interface IsCodeBlock {
  content: string;
}

export class CodeBlock implements IsCodeBlock {
  private readonly project: Project;
  private readonly sourceFile: SourceFile;

  constructor(readonly content: string, readonly source?: string) {
    // Using ts-morph constructor because (for some reason) it causes getSymbolAtLocation to actually return something
    this.project = new Project({
      useInMemoryFileSystem: true,
      compilerOptions: {
        allowJs: true,
        target: ScriptTarget.ES2021,
        noEmit: true,
      },
    });

    this.sourceFile = this.project.createSourceFile("snippet.js", content);
  }

  get diagnostics(): Diagnostic[] {
    return this.project.getPreEmitDiagnostics();
  }

  public getNodeDefinition(node: Node): string {
    let definition: string | undefined;
    const defnSymbol = this.project.getTypeChecker().getSymbolAtLocation(node);
    if (defnSymbol) {
      const valueDeclaration = defnSymbol.getValueDeclaration();
      definition = valueDeclaration?.getText();
      if (
        valueDeclaration &&
        valueDeclaration.isKind(SyntaxKind.VariableDeclaration)
      ) {
        const valueStatement = valueDeclaration?.getVariableStatement();
        definition = valueStatement?.getText();
      }
    }
    return definition ?? "";
  }

  public getJsDocParams(
    jsDocs: JSDoc[]
  ): { name: string; type: Type | undefined }[] {
    const paramTags: { name: string; type: Type | undefined }[] = [];
    jsDocs.forEach((jsDoc: JSDoc) => {
      // const description = jsDoc.getDescription();
      // const comment = jsDoc.getCommentText();
      const tags = jsDoc.getTags();

      tags?.forEach((tag: JSDocTag) => {
        const tagName = tag.getTagName();
        // const tagcomment = tag.getCommentText();
        // const tagText = tag.getText();
        let paramName = "";
        let paramType;

        if (tag instanceof JSDocParameterTag) {
          const paramTag = tag as JSDocParameterTag;
          paramName = paramTag.getName();
          paramType = paramTag.getType();
        }
        if (tagName === "param") {
          paramTags.push({ name: paramName, type: paramType });
        }
      });
    });
    return paramTags;
  }

  public prettyPrintType(type: string | undefined): string {
    if (type === undefined || type === "any") {
      return ""; // "unknown"
    } else if (type === "RegExp") {
      return "regex";
    } else if (type?.endsWith("}[]")) {
      return "object[]";
    } else if (type?.endsWith("[]") && type?.includes("=>")) {
      return "function[]";
    } else if (type?.startsWith("{")) {
      return "object";
    } else if (type?.startsWith("(")) {
      return "function";
    }
    return type;
  }

  public getSignatures(): CallSignature[] {
    const sigs: CallSignature[] = [];
    const checker = this.project.getTypeChecker();
    const calls = this.getUnnestedCallExpressions();

    for (const call of calls) {
      const usage = call.getText();
      const signature = checker.getResolvedSignature(call);
      const declaration = signature?.getDeclaration();
      const returnType =
        declaration?.getReturnType() ??
        signature?.getReturnType() ??
        call.getType();
      const exp = call.getExpression();

      let definition = "";
      let parentType = declaration?.getParent()?.getType();
      if (Node.isPropertyAccessExpression(exp)) {
        if (!parentType) {
          parentType = exp.getExpression().getType();
        }
        definition = this.getNodeDefinition(exp.getExpression());
      }

      let name = "";
      if (declaration && Node.isMethodSignature(declaration)) {
        name = declaration.getName();
      } else if (Node.isPropertyAccessExpression(exp)) {
        name = exp.getName();
      } else if (Node.isIdentifier(exp)) {
        name = exp.getText();
        definition = this.getNodeDefinition(exp);
      }

      const jsdocs =
        declaration &&
        !Node.isFunctionTypeNode(declaration) &&
        !Node.isConstructorTypeNode(declaration) &&
        !Node.isJSDocFunctionType(declaration)
          ? declaration.getJsDocs()
          : [];
      const paramTags = this.getJsDocParams(jsdocs);
      const declarationParamters =
        declaration && !Node.isIndexSignatureDeclaration(declaration)
          ? declaration.getParameters()
          : [];
      const args = call.getArguments().map((arg, i) => {
        const param = declarationParamters[i];
        const name = param?.getText();
        let type = param?.getType();
        if (!type || type.isAny() || type.isUnknown()) {
          const jsDocParamTag = paramTags.find(
            (paramTag) => paramTag.name === name
          );
          if (jsDocParamTag && jsDocParamTag.type) {
            type = jsDocParamTag.type;
          } else {
            type = arg.getType();
          }
        }

        return { name, type };
      });

      const returnTypeText = returnType?.getBaseTypeOfLiteralType().getText();
      const parentTypeText = parentType?.getBaseTypeOfLiteralType().getText();
      const argsTypeText = args.map((arg) =>
        Object.assign(arg, {
          type: arg.type.getBaseTypeOfLiteralType().getText(),
        })
      );

      const prettyParentType = this.prettyPrintType(parentTypeText);
      const prettyReturnType = this.prettyPrintType(returnTypeText);
      const prettyArgTypes = argsTypeText.map((arg) => {
        const prettyArgType = this.prettyPrintType(arg.type);
        return prettyArgType ? prettyArgType : "unknown";
      });
      sigs.push({
        text: `${
          prettyParentType ? prettyParentType + "." : ""
        }${name}(${prettyArgTypes.join(", ")})${
          prettyReturnType ? ": " + prettyReturnType : ""
        }`,
        parentType: parentTypeText,
        name,
        arguments: argsTypeText,
        returnType: returnTypeText,
        usage,
        definition,
        source: this.content,
      });
    }

    return sigs;
  }

  public getCallExpressions(): CallExpression[] {
    const nodes: CallExpression[] = [];
    const matcher = (node: Node) => {
      if (Node.isCallExpression(node)) {
        nodes.push(node);
      }
      node.forEachChild(matcher);
    };
    this.sourceFile.forEachChild(matcher);
    return nodes;
  }

  public getUnnestedCallExpressions(): CallExpression[] {
    const callsToReturn: CallExpression[] = [];
    const calls = this.getCallExpressions();
    let flag = true;
    for (const call of calls) {
      const exp = call.getExpression();

      if (Node.isIdentifier(exp)) {
        // ignore alert() call expressions
        const text = exp.getText();
        if (text === "alert" || text === "require") {
          flag = false;
        }
      } else if (Node.isPropertyAccessExpression(exp)) {
        // ignore console.*() call expressions
        if (exp.getExpression().getText() === "console") {
          flag = false;
        }
      }
      // ignore call expressions which are nested inside a (function) block
      this.ascend(call, (node) => {
        if (Node.isBlock(node) || Node.isArrowFunction(node)) {
          flag = false;
        }
      });

      if (flag) {
        callsToReturn.push(call);
      }
      flag = true;
    }
    return callsToReturn;
  }
  getTokenFromIdentifier(identifier: Identifier): CodeToken {
    return {
      name: identifier.getText(),
      position: { start: identifier.getPos(), end: identifier.getEnd() },
      source: this.source,
    };
  }

  getNodePosition(node: Node | undefined): TokenPosition | undefined {
    if (!node) {
      return;
    }

    return {
      start: node.getPos() + node.getLeadingTriviaWidth(),
      end: node.getEnd(),
    };
  }

  public getFunctions(): FunctionDeclaration[] {
    return this.sourceFile.getFunctions();
  }

  public getImports(): ImportDeclaration[] {
    return this.sourceFile.getImportDeclarations();
  }

  public getFunctionTypes(functionDeclaration: FunctionDeclaration): FunctionToken {
    return {
      source: this.source,
      name: functionDeclaration.getName() ?? "",
      position: this.getNodePosition(functionDeclaration),
      variables: functionDeclaration.getVariableDeclarations().map(vari => ({
        source: this.source,
        name: vari.getName(), 
        position: this.getNodePosition(vari), 
        type: {
          name: vari.getType().getBaseTypeOfLiteralType().getText(),
          position: this.getNodePosition(vari.getTypeNode()),
        },
      })),
      parameters: functionDeclaration.getParameters().map(param => ({
        source: this.source,
        name: param.getName(),
        position: this.getNodePosition(param),
        type: {
          name: param.getType().getBaseTypeOfLiteralType().getText(),
          position: this.getNodePosition(param.getTypeNode()),
        },
      })),
      returnType: functionDeclaration.getReturnType().getBaseTypeOfLiteralType().getText(),
    };
  }

  public getExternalImports(): CodeToken[] {
    const imports = this.sourceFile.getImportDeclarations();
    return imports.flatMap(imp => this.getImportTokens(imp)).filter(token => !token.module.name.includes("/"));
  }

  public getImportTokens(importDeclaration: ImportDeclaration): ImportToken[] {
    const importClause = importDeclaration.getImportClause();
    const namedBindings = importClause?.getNamedBindings();
    const moduleNode = importDeclaration.getModuleSpecifier();

    const importNodes: Identifier[] = [];
    if (Node.isNamespaceImport(namedBindings)) {
      // import * as c from 'foo'
      const identifier = namedBindings.getNameNode();
      importNodes.push(identifier);
    } else if (Node.isNamedImports(namedBindings)) {
      // import {} from 'foo'
      const specifiers = namedBindings.getElements();
      importNodes.push(...specifiers.map(s => s.getNameNode()));
    } else {
      // import x from 'foo'
      const defaultImport = importClause?.getDefaultImport();
      if (defaultImport) {
        importNodes.push(defaultImport);
      }
    }

    return importNodes.map(node => ({
      source: this.source,
      name: node.getText(),
      position: this.getNodePosition(node),
      module: {
        name: moduleNode.getLiteralText(),
        position: this.getNodePosition(moduleNode),
      },
      references: node.findReferencesAsNodes().filter((_, i) => i > 0).map(ref => this.getNodePosition(ref)),
    }));
  }

  public getPrettyDiagnostics(): string {
    return this.project.formatDiagnosticsWithColorAndContext(this.diagnostics);
  }

  private ascend(node: Node, cb: (node: Node) => void): void {
    const parent = node.getParent();
    if (parent) {
      cb(parent);
      this.ascend(parent, cb);
    }
  }
}
