import * as vscode from "vscode";
import markdownLinkExtractor = require("markdown-link-extractor");
import Util from "./Util";

export default class NodeModule {
  public readonly path: vscode.Uri;

  constructor(public readonly name: string) {
    this.path = vscode.Uri.joinPath(
      Util.getWorkspaceUri(0),
      "node_modules",
      name
    );
  }

  async getDocumentationSites(): Promise<string[] | undefined> {
    const readmePath = vscode.Uri.joinPath(this.path, "README.md");
    try {
      const buffer = await vscode.workspace.fs.readFile(readmePath);
      const markdown = new TextDecoder("utf-8").decode(buffer);
      const links = markdownLinkExtractor(markdown, true);
      return [
        ...new Set(
          links
            .filter((link) => link.text.toLowerCase().includes("doc"))
            .map((link) => new URL(link.href).hostname)
        ),
      ];
    } catch (err) {
      console.warn("Failed to read README.md for project", this.name, err);
    }
  }

  getTypingsFile(): vscode.Uri | undefined {
    const typingsFilePath = vscode.Uri.joinPath(this.path, "index.d.ts");
    try {
      vscode.workspace.fs.stat(typingsFilePath);
      return typingsFilePath;
    } catch {
      // do nothing
    }
  }
}
