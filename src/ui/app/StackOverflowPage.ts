import Page, { Fragment, PageOption, Recommendation } from "@/Page";
import Block from "@/Block";
import { StackOverflowAnswer } from "./StackOverflowAnswer";

export default class StackOverflowPage extends Page {
  readonly answers: StackOverflowAnswer[];

  constructor(readonly doc: Document, ...options: PageOption[]) {
    super(doc, ...options);
    const titleParts = doc.title.split(" - ");
    this._title = titleParts
      .slice(0, titleParts.length - 1)
      .filter((part) => part.includes(" "))
      .join(" - ");

    // const answerElements = doc.body.querySelectorAll<HTMLDivElement>(".answer");
    // this.answers = Array.from(answerElements).map(
    //   (el) => new StackOverflowAnswer(el)
    // );
    this.answers = [];
  }

  public getAcceptedAnswer(): StackOverflowAnswer | undefined {
    return this.answers.filter((answer) => answer.isAccepted)[0];
  }

  public getLatestAnswer(): StackOverflowAnswer | undefined {
    return this.answers.sort(
      (a, b) =>
        (b.modified?.getTime() ?? b.created?.getTime() ?? 0) -
        (a.modified?.getTime() ?? a.created?.getTime() ?? 0)
    )[0];
  }

  public getPopularAnswer(): StackOverflowAnswer | undefined {
    return this.answers.sort((a, b) => b.voteCount - a.voteCount)[0];
  }

  public getRecommendations(): Recommendation[] {
    const latestAnswer = this.getLatestAnswer();
    const popularAnswer = this.getPopularAnswer();
    const recommendations: { [signature: string]: Recommendation } = {};

    for (const answer of this.answers) {
      const sigs = answer.getSignatures();

      for (const sig of sigs) {
        const sigString = sig.signature.toString();
        if (!Object.prototype.hasOwnProperty.call(recommendations, sigString)) {
          recommendations[sigString] = {
            signature: sig.signature,
            usages: [],
            examples: [],
            metrics: {
              occurrences: 0,
              isFromAcceptedAnswer: false,
              isFromPopularAnswer: false,
              isFromLatestAnswer: false,
            },
          };
        }
        const s = recommendations[sigString];
        s.usages.push({
          ref: answer.url,
          code: sig.sourceCodeBlock,
          text: sig.signature.usage,
        });
        s.examples?.push({
          answerURL: answer.url,
          call: sig.signature.usage,
          declaration: sig.signature.definition,
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

    return Object.values(recommendations);
  }

  public getBlocks(): Block[] {
    const answers = Array.from(
      this.doc.querySelectorAll<HTMLDivElement>(".answer")
    );
    const blocks = answers.map(
      (answer) =>
        new Block(
          answer.dataset.answerid || "",
          answer.querySelector(".s-prose") as HTMLElement
        )
    );
    this._blocks = blocks;
    return blocks;
  }

  /**
   * For Stackoverflow, a fragment is a paragraph, list item, or pre-formatted
   * text contained within an answer block which has one or more of the search
   * keywords.
   * @param block
   * @param keywords
   * @returns
   */
  public getFragments(block: Block, keywords: string[]): Fragment[] {
    const fragments: Fragment[] = Array.from(
      block.element.querySelectorAll<HTMLElement>("p,pre,li")
    ).map((element, i) => ({
      id: i,
      blockId: block.identifier,
      element,
      matches: this.findKeywords(keywords, element),
    }));

    this._fragments.push(...fragments);
    return fragments;
  }

  /** Sort based solely on number of matches */
  public sortFragments(fragments: Fragment[]): Fragment[] {
    return fragments
      .slice()
      .sort((a, b) => b.matches.length - a.matches.length);
  }
}
