// import * as parse5 from "parse5";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore Not sure why TS can't see @types/parse5
import { parse, Document, Element, Node } from "parse5";
import {
  getTagName,
  getAttribute,
  findElements,
  findElement,
  isTextNode,
  isCommentNode,
  findNodes,
  hasAttribute,
} from "@web/parse5-utils";
import { CodeBlock } from "./CodeBlock";
import { StackOverflowCallSignature } from "../types";

export default class StackOverflowPage {
  public readonly answers: StackOverflowAnswer[];
  private readonly doc: Document;

  constructor(readonly content: string) {
    this.doc = parse(content);
    this.answers = this.getAnswers();
  }

  public getAnswers(): StackOverflowAnswer[] {
    return findElements(
      this.doc,
      (e) =>
        getTagName(e) === "div" &&
        (getAttribute(e, "id")?.startsWith("answer-") ?? false)
    ).map((e) => new StackOverflowAnswer(e));
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
}

export class StackOverflowAnswer {
  readonly id: string;
  readonly url: string;
  readonly isAccepted: boolean;
  readonly voteCount: number;
  readonly created?: Date;
  readonly modified?: Date;

  constructor(readonly element: Element) {
    this.id = this.getId();
    this.url = `https://stackoverflow.com/a/${this.id}`;
    this.isAccepted = this.getAcceptanceStatus();
    this.voteCount = this.getVoteCount();
    this.created = this.getDateCreated();
    this.modified = this.getDateModified();
  }

  getId(): string {
    return getAttribute(this.element, "data-answerid") ?? "";
  }

  getAcceptanceStatus(): boolean {
    return (
      getAttribute(this.element, "class")
        ?.split(" ")
        .includes("accepted-answer") ?? false
    );
  }

  getVoteCount(): number {
    return Number(getAttribute(this.element, "data-score") ?? 0);
  }

  getDateCreated(): Date | undefined {
    let date: Date | undefined;

    const e = findElement(
      this.element,
      (e) => getAttribute(e, "itemprop") === "dateCreated"
    );
    if (e) {
      const dateStr = getAttribute(e, "datetime");
      if (dateStr) {
        date = new Date(dateStr);
      }
    }

    return date;
  }

  getDateModified(): Date | undefined {
    let date: Date | undefined;

    const e = findElement(
      this.element,
      (e) =>
        hasAttribute(e, "title") &&
        (getAttribute(e, "class")?.split(" ").includes("relativetime") ?? false)
    );

    if (e) {
      const dateStr = getAttribute(e, "title");
      if (dateStr) {
        date = new Date(dateStr);
      }
    }

    return date;
  }

  // async getSignatures(worker: Worker, id: number): Promise<Signature[]> {
  //   console.time(`[TIME] Thread ${id}`);
  //   const content = this.getCodeContent();
  //   // const content = `symbol + value.toFixed(2).replace(/(\d)(?=(\d{3})+\.)/g, "$1,").replace(/\.00/g, '')`;
  //   worker.postMessage(content);
  //   return new Promise<Signature[]>((resolve) => {
  //     worker.onmessage = (e) => {
  //       // Use a set since answers often make multiple calls to the same method as examples
  //       const uniqSigs: { [sigStr: string]: Signature } = {};
  //       e.data.filter(function (signature: Signature) {
  //         return Object.prototype.hasOwnProperty.call(uniqSigs, signature.text)
  //           ? false
  //           : (uniqSigs[signature.text] = signature);
  //       });
  //       console.timeEnd(`[TIME] Thread ${id}`);
  //       resolve(Object.values(uniqSigs));
  //     };
  //   });
  // }

  /**
   * Get all unique top-level call signatures in the answer.
   */
  getSignatures(): StackOverflowCallSignature[] {
    // const uniqSigs: { [sigStr: string]: Signature } = {};
    const content = this.getCodeContent();
    const block = new CodeBlock(content);
    return block.getSignatures().map((sig) =>
      Object.assign(sig, {
        answerId: this.getId(),
        answerUrl: `https://stackoverflow.com/a/${this.getId()}`,
        voteCount: this.voteCount,
        isAccepted: this.isAccepted,
        lastModified: this.modified ?? this.created,
      })
    );
    // block.getSignatures().filter((signature: Signature) => {
    //   return Object.prototype.hasOwnProperty.call(uniqSigs, signature.text)
    //     ? false
    //     : (uniqSigs[signature.text] = signature);
    // });
    // return Object.values(uniqSigs);
  }

  /**
   * Concatenates the content of all <pre><code></code></pre> blocks in the answer.
   * @returns string
   */
  getCodeContent(): string {
    return findElements(this.element, (e) => getTagName(e) === "pre")
      .map((e) => this.getTextContent(e))
      .join("\n");
  }

  getKeywords(keywords: string[]): string[] {
    const text = this.getTextContent(this.element);
    const regex = new RegExp(keywords.join("|"), "g");
    return text.match(regex) ?? [];
  }

  getWords(): string[] {
    return this.getTextContent(this.element).split(" ");
  }

  private getTextContent(node: Node): string {
    if (isCommentNode(node)) {
      return node.data || "";
    }
    if (isTextNode(node)) {
      return node.value || "";
    }
    const subtree = findNodes(node, (n) => isTextNode(n));
    return subtree.map((e) => this.getTextContent(e)).join("");
  }
}
