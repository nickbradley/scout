import { StackOverflowCallSignature } from "../../common/types";
import ProxyRequest from "../ProxyRequest";
import StackOverflowPage from "..//StackOverflowPage2";

import { parentPort } from "worker_threads";

export interface Recommendation {
  readonly text: string;
  readonly name: string;
  readonly parameters: string[];
  readonly returnType: string;
  readonly parentType: string | undefined;
  readonly examples: Array<{
    answerId: string;
    answerURL: string;
    call: string;
    declaration: string;
    text: string;
  }>;
  readonly metrics: {
    occurrences: number;
    isFromAcceptedAnswer: boolean;
    isFromPopularAnswer: boolean;
    isFromLatestAnswer: boolean;
  };
}
/*
// Handle promises that reject (https://stackoverflow.com/questions/67092919)
self.addEventListener("unhandledrejection", (event) => {
  // Prevent this being reported (Firefox doesn't currently respect this)
  event.preventDefault();

  // Throwing here will trigger the worker's `error` event, since this
  // isn't `async` code and nothing handles it
  throw event.reason;
});
*/
if (!parentPort) {
  throw new Error("parentPort is not defined");
}
parentPort.on("message", async function (message) {
  console.log("[**] HELLO FROM Worker", message);
  const url = message.pageURL;
  const searchTerms = message.searchTerms ?? [];
  const response = await ProxyRequest.fetch(url, { requestedWith: "XMLHttpRequest" });
  const text = await response.text();
  const page = new StackOverflowPage(text);
  const answers = page.getAnswers();
  const signatures: StackOverflowCallSignature[] = answers.flatMap((ans) =>
    ans.getSignatures().map((sig) => ({
      answerKeywords: ans.getKeywords(searchTerms),
      answerWordCount: ans.getWords().length,
      ...sig,
    }))
  );
  console.log("[**] Posting from worker", signatures);
  parentPort.postMessage(signatures);
});
