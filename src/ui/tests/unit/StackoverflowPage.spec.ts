import StackoverflowPage from "../../app/StackoverflowPage";
import { JSDOM } from "jsdom";

let page: StackoverflowPage;

const url =
  "https://stackoverflow.com/questions/41658687/bcrypt-password-comparing-with-compare-method-always-results-with-error";
// const url = "https://stackoverflow.com/questions/32811510/mongoose-findoneandupdate-doesnt-return-updated-document"

beforeAll(async () => {
  const dom = await JSDOM.fromURL(url, {
    //   runScripts: "dangerously",
    pretendToBeVisual: true,
    resources: "usable",
  });
  page = new StackoverflowPage(dom.window.document);
});

test("blocks", () => {
  const blocks = page.getBlocks();
  expect(blocks.length).toBe(12);
});

test("fragments", () => {
  const blocks = page.getBlocks();
  const fragments = page.getFragments(blocks[0], [
    "match",
    "passwords",
    "javascript",
    "bcrypt",
    "mongodb"
  ]);
  console.log(fragments);
  console.log("Done");
  expect(true).toBeTruthy;
});

test("sorting", () => {
  const blocks = page.getBlocks();
  const fragments = page.getFragments(blocks[0], [
    "return",
    "updated",
    "document",
  ]);
  const sorted = page.sortFragments(fragments);
  console.log(sorted);
  expect(true).toBeTruthy;
});
