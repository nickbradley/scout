import { CodeBlock } from "../CodeBlock2";
import { CodeToken} from "../types";

import { parentPort } from "worker_threads";


// self.addEventListener("unhandledrejection", (event) => {
//     // Prevent this being reported (Firefox doesn't currently respect this)
//     event.preventDefault();
  
//     // Throwing here will trigger the worker's `error` event, since this
//     // isn't `async` code and nothing handles it
//     throw event.reason;
//   });

if (!parentPort) {
  throw new Error("parentPort is not defined");
}
parentPort.on("message", async function (message) {
    let fnId = "";
    const codeTokens: Array<CodeToken> = [];
    const text = message.text;
    const filename = message.filename;
    const cursorPosition = message.cursorPosition;

    console.log("ContextWorker", filename, cursorPosition);
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
            .filter(token => token.references.some(ref => activeFunction.containsRange(ref?.start ?? -1 , ref?.end ?? -1)));
        const functionTokens = code.getFunctionTypes(activeFunction);
        codeTokens.push(...importTokens, functionTokens);
    }
  
    parentPort.postMessage({ functionId: fnId, codeTokens });
  });