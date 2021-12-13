import * as vscode from "vscode";

export default class Util {
  public static getWorkspaceUri(workspaceIndex: number): vscode.Uri {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || !workspaceFolders[workspaceIndex]) {
      throw new Error("The specified workspace is not open.");
    }

    return workspaceFolders[workspaceIndex].uri;
  }

  public static async readWorkspaceFile(
    filename: string,
    workspaceIndex: number = 0
  ): Promise<string> {
    const rootPath = Util.getWorkspaceUri(workspaceIndex);
    const dataFile = vscode.Uri.joinPath(rootPath, filename);
    const enc = new TextDecoder("utf-8");
    const dataBuffer = await vscode.workspace.fs.readFile(dataFile);
    return enc.decode(dataBuffer);
  }

  /**
   * Writes data to a file in the workspace.
   * @param filename
   * @param data
   */
  public static async writeWorkspaceFile(
    filename: string,
    data: string | ArrayBuffer,
    workspaceIndex: number = 0
  ): Promise<void> {
    const rootPath = Util.getWorkspaceUri(workspaceIndex);
    const dataFile = vscode.Uri.joinPath(rootPath, filename);

    let content: Uint8Array;
    if (typeof data === "string") {
      content = new TextEncoder().encode(data);
    } else {
      content = new Uint8Array(data);
    }
    return vscode.workspace.fs.writeFile(dataFile, content);
  }

  public static async removeWorkspaceFile(
    filename: string,
    workspaceIndex: number = 0
  ): Promise<void> {
    const rootPath = Util.getWorkspaceUri(workspaceIndex);
    const uri = vscode.Uri.joinPath(rootPath, filename);

    return vscode.workspace.fs.delete(uri);
  }

  public static merge(source: any, target: any) {
    for (const [key, val] of Object.entries(source)) {
      if (val !== null && typeof val === `object`) {
        if (target[key] === undefined) {
          // @ts-ignore
          target[key] = new val.__proto__.constructor();
        }
        Util.merge(val, target[key]);
      } else {
        target[key] = val;
      }
    }
    return target;
  }
}
