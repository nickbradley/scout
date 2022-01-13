import * as ts from "typescript";

export default class Lexer {
  public readonly tokens: string[] = [];

  public parse(sourceText: string): string[] {
    const sourceFile = ts.createSourceFile(
        "",
        sourceText,
        ts.ScriptTarget.ES2021,
        true
    );

    ts.forEachChild(sourceFile, this.tokenize.bind(this));
    
    return this.tokens;
  }

  private tokenize(node: ts.Node): void {
    if (
      node.kind === ts.SyntaxKind.Identifier ||
      node.kind === ts.SyntaxKind.StringLiteral
    ) {
      const text = node.getText();
      this.tokens.push(text);
    }
    ts.forEachChild(node, this.tokenize.bind(this));
  }
}
