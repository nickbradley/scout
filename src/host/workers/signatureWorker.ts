import process from "process";
import { parentPort } from "worker_threads";
import fetch from "isomorphic-unfetch";

import { StackOverflowCallSignature } from "../../types";
import StackOverflowPage from "../StackOverflowPage";

process.on("uncaughtException", (error) => {
  throw error;
});

process.on("unhandledRejection", (reason) => {
  throw reason;
});

parentPort!.on("message", async function (message) {
  const url = message.pageURL;
  const searchTerms = message.searchTerms ?? [];
  const response = await fetch(url, {headers:{ requestedWith: "XMLHttpRequest" }});
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
  parentPort!.postMessage(signatures);
});
