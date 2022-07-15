import 'dotenv/config'
import ProxyRequest from "../common/ProxyRequest";
import StackOverflowPage from "../common/StackOverflowPage2";
import SerpSearchProvider from "../common/SerpSearchProvider";

const serpApiToken = process.env["SEARCH_API_TOKEN"] ?? "";

// TODO read the search string and emit json signatures
const search = process.argv.slice(2).join(" ");

(async () => {

const googleProvider = new SerpSearchProvider(serpApiToken);
const searchResults = await googleProvider.fetch(search);
console.log("Found", searchResults.length, "results");

for (const r of searchResults) {
  const response = await ProxyRequest.fetch(r.url);
  const text = await response.text();
  const page = new StackOverflowPage(text);
  const answers = page.getAnswers();
  const latestAnswer = page.getLatestAnswer();
  const popularAnswer = page.getPopularAnswer();
  const result: { [sigStr: string]: any } = {};  //:Recommendation
  const signatures: any[][] = answers.map((ans: any) => ans.getSignatures());  //:Signature

  for (const [i, answer] of answers.entries()) {
    for (const sig of signatures[i]) {
      if (!Object.prototype.hasOwnProperty.call(result, sig.text)) {
        result[sig.text] = {
          text: sig.text,
          name: sig.name,
          parameters: sig.parameters,
          returnType: sig.returnType,
          parentType: sig.parentType,
          examples: [],
          metrics: {
            occurrences: 0,
            isFromAcceptedAnswer: false,
            isFromPopularAnswer: false,
            isFromLatestAnswer: false,
          },
        };
      }
      const s = result[sig.text];
      s.examples.push({
        answerId: answer.id,
        answerURL: `https://stackoverflow.com/a/${answer.id}`,
        call: sig.usage,
        declaration: sig.definition,
        text: (sig.definition ? sig.definition + "\n\n" : "") + sig.usage,
      });
      s.metrics.occurrences++;
      s.metrics.isFromAcceptedAnswer =
        s.metrics.isFromAcceptedAnswer || answer.isAccepted;
      s.metrics.isFromPopularAnswer =
        s.metrics.isFromPopularAnswer || popularAnswer?.id === answer.id;
      s.metrics.isFromLatestAnswer =
        s.metrics.isFromLatestAnswer || latestAnswer?.id === answer.id;
    }
  }
  console.log(Object.keys(result));
}

})();