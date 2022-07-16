import {
  Project,
  ts,
  Node,
  SourceFile,
  CallExpression,
  Diagnostic,
} from "ts-morph";
import { CallSignature } from "../../common/types";

export interface Signature {
  readonly text: string;
  readonly name: string;
  readonly parameters: string[];
  readonly returnType: string;
  readonly parentType: string | undefined;
  readonly usage: string;
  readonly definition: string;
}

export interface IsCodeAnnotation {
  value: string;
}

export interface IsCodeBlock {
  content: string;
}

function nodeToStr(node: Node): string {
  const type = node.getType().getBaseTypeOfLiteralType().getText();
  if (type === "any") {
    return "unknown";
  } else if (type === "RegExp") {
    return "regex";
  } else if (type.startsWith("{")) {
    return "object";
  } else if (type.startsWith("(")) {
    return "function";
  }
  return type;
}

export class CodeBlock implements IsCodeBlock {
  // public readonly program: ts.Program;

  private readonly project: Project;
  private readonly sourceFile: SourceFile;
  // private readonly checker: TypeChecker;

  // constructor(readonly content: string) {
  //     const lang = "js";
  //     const filename = `snippet.${lang}`;  // this is a virtual filename
  //     const options: ts.CompilerOptions = {
  //         allowJs: true,
  //         module: ts.ModuleKind.None,
  //         target: ts.ScriptTarget.ES2021,
  //         strict: false,
  //     }

  //     this.sourceFile = ts.createSourceFile(
  //         filename,
  //         content,
  //         ts.ScriptTarget.ES2021,
  //         true
  //     );

  //     this.program = ts.createProgram([filename], options);
  //     this.checker = this.program.getTypeChecker();

  //     const diagnostics = ts.getPreEmitDiagnostics(this.program);
  //     console.log("Error count", diagnostics.length);
  //     // fs.writeFileSync("error.log", JSON.stringify(diagnostics));
  //     console.log(diagnostics[0]);
  // }

  constructor(readonly content: string) {
    // Using ts-morph constructor because (for some reason) it causes getSymbolAtLocation to actually return something
    this.project = new Project({
      useInMemoryFileSystem: true,
      compilerOptions: {
        allowJs: true,
        target: ts.ScriptTarget.ES2021,
        noEmit: true,
      },
    });

    this.sourceFile = this.project.createSourceFile("snippet.js", content); //, {scriptKind: ts.ScriptKind.TS}
    // this.program = project.createProgram();
    // this.checker = this.project.getTypeChecker();

    // const diagnostics = ts.getPreEmitDiagnostics(project.createProgram());
  }

  get diagnostics(): Diagnostic[] {
    return this.project.getPreEmitDiagnostics();
  }

  public getSignatures(): CallSignature[] {
    const sigs: Signature[] = [];
    const calls = this.getUnnestedCallExpressions();
    const getDefn = (node: Node): string => {
      let definition;
      const defnSymbol = this.project
        .getTypeChecker()
        .getSymbolAtLocation(node);
      if (defnSymbol) {
        const valueDeclaration = defnSymbol.getValueDeclaration();
        definition = valueDeclaration?.getText();
        if (
          valueDeclaration &&
          valueDeclaration.isKind(ts.SyntaxKind.VariableDeclaration)
        ) {
          const valueStatement = valueDeclaration?.getVariableStatement();
          definition = valueStatement?.getText();
        }
      }
      return definition ?? "";
    };
    const checker = this.project.getTypeChecker();

    for (const call of calls) {
      const signature = checker.getResolvedSignature(call);
      const declaration = signature?.getDeclaration(); //.getText() returns the full signature

      let parentType;
      let definition = "";
      const exp = call.getExpression();
      if (Node.isPropertyAccessExpression(exp)) {
        parentType = nodeToStr(exp.getExpression());
        definition = getDefn(exp.getExpression());
      }
      let name = "foo";
      const usage = call.getText();

      if (declaration && Node.isMethodSignature(declaration)) {
        name = declaration.getName();
      } else if (Node.isPropertyAccessExpression(exp)) {
        name = exp.getName();
      } else if (Node.isIdentifier(exp)) {
        name = exp.getText();
        definition = getDefn(exp);
      }

      const args = call.getArguments().map(nodeToStr); // CodeBlock.getTypeName(arg.kind));
      // console.log("ARGUMENTS", args, call.arguments.map(a => a.kind));
      const returnType = nodeToStr(call); //.getReturnType().getText();//this.checker.typeToString(this.checker.getTypeAtLocation(call)); // this.checker.typeToString(signature?.getReturnType());

      sigs.push(
        // new Signature(name, args, returnType, parentType, usage, definition)
        {
          text: `${parentType ? parentType + "." : ""}${name}(${args
            .map((p) => p || "unknown")
            .join(", ")}): ${returnType}`,
          name,
          parameters: args,
          returnType,
          parentType,
          usage,
          definition,
        }
      );
    }

    return sigs;
  }

  public getCallExpressions(): CallExpression[] {
    const nodes: CallExpression[] = [];
    const matcher = (node: Node<ts.Node>) => {
      if (Node.isCallExpression(node)) {
        nodes.push(node);
      }
      // if (node.kind === ts.SyntaxKind.CallExpression) {
      //     nodes.push(node as CallExpression);
      // }
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
