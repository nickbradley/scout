import { StackOverflowCallSignature } from "../../common/types";
import { Signature } from "../app/CodeBlock";
import ProxyRequest from "../app/ProxyRequest";
import StackOverflowPage from "../app/StackOverflowPage2";

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

// Handle promises that reject (https://stackoverflow.com/questions/67092919)
self.addEventListener("unhandledrejection", (event) => {
  // Prevent this being reported (Firefox doesn't currently respect this)
  event.preventDefault();

  // Throwing here will trigger the worker's `error` event, since this
  // isn't `async` code and nothing handles it
  throw event.reason;
});

onmessage = async function (e) {
  const url = e.data.pageURL;
  const response = await ProxyRequest.fetch(url);
  const text = await response.text();
  const page = new StackOverflowPage(text);
  const answers = page.getAnswers();
  // const latestAnswer = page.getLatestAnswer();
  // const popularAnswer = page.getPopularAnswer();
  // const result: { [sigStr: string]: Recommendation } = {};
  const signatures: StackOverflowCallSignature[] = answers.flatMap((ans) =>
    ans.getSignatures()
  );

  // for (const [i, answer] of answers.entries()) {
  //   for (const sig of signatures[i]) {
  //     if (!Object.prototype.hasOwnProperty.call(result, sig.text)) {
  //       result[sig.text] = {
  //         text: sig.text,
  //         name: sig.name,
  //         parameters: sig.parameters,
  //         returnType: sig.returnType,
  //         parentType: sig.parentType,
  //         examples: [],
  //         metrics: {
  //           occurrences: 0,
  //           isFromAcceptedAnswer: false,
  //           isFromPopularAnswer: false,
  //           isFromLatestAnswer: false,
  //         },
  //       };
  //     }
  //     const s = result[sig.text];
  //     s.examples.push({
  //       answerId: answer.id,
  //       answerURL: `https://stackoverflow.com/a/${answer.id}`,
  //       call: sig.usage,
  //       declaration: sig.definition,
  //       text: (sig.definition ? sig.definition + "\n\n" : "") + sig.usage,
  //     });
  //     s.metrics.occurrences++;
  //     s.metrics.isFromAcceptedAnswer =
  //       s.metrics.isFromAcceptedAnswer || answer.isAccepted;
  //     s.metrics.isFromPopularAnswer =
  //       s.metrics.isFromPopularAnswer || popularAnswer?.id === answer.id;
  //     s.metrics.isFromLatestAnswer =
  //       s.metrics.isFromLatestAnswer || latestAnswer?.id === answer.id;
  //   }
  // }
  // postMessage(Object.values(result));
  postMessage(signatures);
};
