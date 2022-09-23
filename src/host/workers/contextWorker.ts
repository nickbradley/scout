import process from "process";
import { parentPort } from "worker_threads";

import { CodeBlock } from "../CodeBlock";
import { CodeToken} from "../../types";

process.on("uncaughtException", (error) => {
  throw error;
});

process.on("unhandledRejection", (reason) => {
  throw reason;
});

parentPort!.on("message", async function (message) {
    let fnId = "";
    const codeTokens: Array<CodeToken> = [];
    const text = message.text;
    const filename = message.filename;
    const cursorPosition = message.cursorPosition;
    const code = new CodeBlock(text, filename);

    // Get the function containing position
    const activeFunction = code.getFunctions().find(fn => fn.getPos() <= cursorPosition && fn.getEnd() >= cursorPosition);
    if (activeFunction) {
        fnId = `${filename} ${activeFunction.getStartLineNumber()}:${activeFunction.getStartLinePos()}-${activeFunction.getEnd()}`;
        const imports = code.getImports();
        // Only include external imports which are referenced in the active function
        const importTokens = imports
            .flatMap(imp => code.getImportTokens(imp))
            .filter(token => !token.module.name.includes("/"))
            // .filter(token => token.references.some(ref => activeFunction.containsRange(ref?.start ?? -1 , ref?.end ?? -1)));
        const functionTokens = code.getFunctionTypes(activeFunction);
        const calls = code.getCallExpressions(activeFunction)
        .filter((exp) => code.isCallExpressionImported(exp))
        .map((exp) => code.getCallTypes(exp));
        codeTokens.push(...importTokens, ...calls, functionTokens);
    }
  
    parentPort!.postMessage({ functionId: fnId, codeTokens });
  });