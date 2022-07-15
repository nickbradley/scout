import { ts } from "ts-morph";
import { CodeBlock } from "./CodeBlock";
import { Signature } from "./Signature";
export interface IsAnswer {
  voteCount: number;
  isAccepted: boolean;
  created: Date | null;
  modified?: Date | null;
  commentCount: number;
  url: string;
}

export class StackOverflowAnswer implements IsAnswer {
  readonly id: number;
  readonly url: string;
  readonly isAccepted: boolean;
  readonly voteCount: number;
  readonly commentCount: number;
  readonly created: Date | null = null;
  readonly modified: Date | null = null;
  readonly codeBlock?: CodeBlock;

  constructor(readonly element: HTMLDivElement) {
    this.id = Number(element.dataset.answerid);
    this.url = `https://stackoverflow.com/a/${this.id}`;
    this.isAccepted = element.classList.contains("accepted-answer");
    this.voteCount = Number(element.dataset.score);

    const commentsList =
      element.querySelector<HTMLUListElement>(".comments-list");
    const visibleComments = commentsList?.childElementCount ?? 0;
    const moreComments =
      Number(commentsList?.dataset.remainingCommentsCount) ?? 0;
    this.commentCount = visibleComments + moreComments;

    const createDate =
      element
        .querySelector("[itemprop=dateCreated]")
        ?.getAttribute("datetime") ?? null;
    if (createDate) {
      this.created = new Date(createDate);
    }

    const modifiedDated =
      element
        .querySelector(".user-action-time span.relativetime")
        ?.getAttribute("title") ?? null;
    if (modifiedDated) {
      this.modified = new Date(modifiedDated);
    }

    const codeBlockContents = Array.from(
      this.element.querySelectorAll<HTMLPreElement>("pre") // .lang-js
    )
      .filter(
        (el) => el.firstElementChild && el.firstElementChild.nodeName === "CODE"
      )
      .map((el) => (el.firstElementChild as HTMLElement).textContent ?? "");
    this.codeBlock = new CodeBlock(codeBlockContents.join("\n"));
    if (this.codeBlock.diagnostics.length > 0) {
      console.warn("The were errors parsing the code block");
      console.log(this.codeBlock.getPrettyDiagnostics());
    }
  }

  get body(): HTMLDivElement {
    return this.element.querySelector("[itemprop=text]") as HTMLDivElement;
  }

  get callSignatures(): ts.Signature[] {
    return [];
  }

  get callNames(): string[] {
    return [];
  }

  getSignatures(): Array<{ signature: Signature; sourceCodeBlock: CodeBlock }> {
    if (!this.codeBlock) {
      return [];
    }

    const results: {
      [sig: string]: { signature: Signature; sourceCodeBlock: CodeBlock };
    } = {};

    const signatures = this.codeBlock.getSignatures();
    for (const signature of signatures) {
      const sigString = signature.toString();
      if (!Object.prototype.hasOwnProperty.call(results, sigString)) {
        results[sigString] = {
          // @ts-expect-error still working on finalizing the design
          signature,
          sourceCodeBlock: this.codeBlock,
        };
      }
    }

    return Object.values(results);
    // Use a set since answers often make multiple calls to the same method as examples
    // return [...new Set(this.codeBlock.getSignatures().map(sig => sig.toString()))];
  }

  getAnnotations(terms: string[]): string[] {
    return this.find(terms)
      .flatMap((match) =>
        Array.from(match.querySelectorAll<HTMLElement>(":not(pre) > code"))
      )
      .map((el) => el.textContent)
      .filter((t) => t !== null) as string[];
    // [...new Set()]
  }
  getText(): string[] {
    return [];
  }

  getInlineCode(): string[] {
    return Array.from(this.element.querySelectorAll<HTMLElement>("code"))
      .filter((el) => el.parentElement?.nodeName !== "PRE")
      .map((el) => el.textContent)
      .filter((t) => t !== null) as string[];
  }

  getCodeBlocks(): CodeBlock[] {
    return Array.from(this.element.querySelectorAll<HTMLPreElement>("pre"))
      .map((el) =>
        el.firstElementChild
          ? new CodeBlock(
              (el.firstElementChild as HTMLElement).textContent ?? ""
            )
          : null
      )
      .filter((t) => t !== null) as CodeBlock[];
  }

  getDateCreated(): Date {
    const datetime =
      Array.from(this.element.querySelectorAll<HTMLTimeElement>("time"))
        .find((el) => el.hasAttribute("dateCreated"))
        ?.getAttribute("datetime") ?? "";
    return new Date(datetime);
  }

  getDateModified(): Date {
    const actionTimeElement = Array.from(
      this.element.querySelectorAll<HTMLDivElement>(".user-action-time")
    );
    const relativeTime = actionTimeElement.find(
      (el) => el.firstChild?.textContent === "edited"
    );
    const datetime =
      relativeTime?.querySelector(".relativetime")?.getAttribute("title") ?? "";
    return new Date(datetime);
  }

  // TODO Find matches here (should return elements)
  find(terms: string[]): HTMLElement[] {
    const matches: HTMLElement[] = [];

    const paras = Array.from(this.body.children);
    for (const para of paras) {
      for (const term of terms) {
        if (para.textContent?.toLowerCase().includes(term)) {
          // console.log(para.tagName, "includes", term, "in", para.textContent?.toLowerCase());
          const element = para as HTMLElement;
          // const type = ["pre", "code"].includes(para.tagName.toLowerCase()) ? "code" : "text";
          // matches.push({element, type});
          matches.push(element);
          break;
        }
      }
    }

    return matches;
  }
}
