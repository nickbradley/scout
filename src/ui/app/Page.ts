import { Snapshooter, CSSStringifier } from "@/Snapshooter";
import Block from "@/Block";
import { Signature } from "./Signature";
import { CodeBlock } from "./CodeBlock";

export interface KeywordMatch {
  /** The keyword that was matched */
  keyword: string;
  /** The matched word in the text content */
  word: string;
  node: Node;
  /** The text of the line containing the matching word */
  lineText: string;
  /** The 0-based index of the line containing the matching word */
  lineIndex: number;
  /** The 0-based index of the matching word in the line */
  offset: number;
}

export interface Fragment {
  id: number;
  blockId: string;
  element: HTMLElement;
  matches: KeywordMatch[];
}

export interface Projection {
  body: string;
  css: string;
  el: HTMLElement | null;
  kind?: "snippet" | "fragment";
}

export interface Recommendation {
  /**
   * Call signature with types abstracted.
   */
  signature: Signature;

  /**
   * Concrete examples extracted from the code blocks sorted by their "quality."
   * `ref` is the url to the answer containing the code block.
   * `code` provides the extract
   */
  usages: Array<{ ref: string; code: CodeBlock; text: string }>;
  examples: Array<{ answerURL: string; call: string; declaration?: string }>;

  /**
   * Information for ranking recommendations.
   */
  metrics: {
    occurrences: number;
    isFromAcceptedAnswer: boolean;
    isFromPopularAnswer: boolean;
    isFromLatestAnswer: boolean;
  };
}

export type PageOption = (p: Page) => void;

export default abstract class Page {
  protected _title: string;
  public projections: Array<{
    url: string;
    type: "snippet" | "fragment";
    blockId: string;
    content: string;
  }>;
  protected _blocks: Block[] = [];
  protected _fragments: Fragment[] = [];
  private observer?: IntersectionObserver;
  private _activeElement?: HTMLElement;

  constructor(readonly doc: Document, ...options: PageOption[]) {
    this._title = doc.title;
    this.projections = [];

    const style = doc.createElement("style");
    doc.head.appendChild(style);
    style.appendChild(doc.createTextNode(this.style));

    for (const option of options) {
      option(this);
    }
  }

  public get title(): string {
    return this._title;
  }

  public get style(): string {
    return `
    body {
      background: white !important;
      padding: 0 !important;
    }
    @-webkit-keyframes yellow-fade {
      from {
        background: #f96;
      }
      to {
        background: #fff;
      }
    }
    @-moz-keyframes yellow-fade {
      from {
        background: #f96;
      }
      to {
        background: #fff;
      }
    }
    @keyframes yellow-fade {
      from {
        background: #f96;
      }
      to {
        background: #fff;
      }
    }
    .fade-in {
      -webkit-animation: yellow-fade 1s ease-in-out 0s;
      -moz-animation: yellow-fade 1s ease-in-out 0s;
      -o-animation: yellow-fade 1s ease-in-out 0s;
      animation: yellow-fade 1s ease-in-out 0s;
    }
    .dismissed {
      opacity: 40%;
    }
    `;
  }

  public set activeElement(element: HTMLElement) {
    this._activeElement = element;
  }

  public highlightOnScroll(): void {
    if (this._activeElement === undefined) {
      return;
    }

    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            this._activeElement?.classList.add("fade-in");
            return;
          }
          this._activeElement?.classList.remove("fade-in");
        });
      },
      { threshold: 0.5 }
    );
    this.observer.observe(this._activeElement);
  }

  public clearHighlighOnScroll(): void {
    this._activeElement?.classList.remove("fade-in");
    this.observer?.disconnect();
  }

  public dismissFragmentBlock(): void {
    if (this._activeElement === undefined) {
      return;
    }

    if (this._blocks.length === 0) {
      this.getBlocks();
    }
    this._blocks
      .find((block) =>
        block.element.contains(this._activeElement as HTMLElement)
      )
      ?.element.classList.add("dismissed");
  }

  public scrollToActiveElement(): void {
    this._activeElement?.scrollIntoView();
  }

  public abstract getBlocks(): Block[];

  public abstract getFragments(block: Block, keywords: string[]): Fragment[];

  public abstract sortFragments(fragments: Fragment[]): Fragment[];

  public findKeywords(keywords: string[], node: Node): KeywordMatch[] {
    const matches: KeywordMatch[] = [];
    const searchTerms = keywords.map((k) => k.toLowerCase());
    const isWord = /^\S+$/;
    const cleanRegex = /[^\p{L}\p{N}\s]/gu;

    const iterator = this.doc.createNodeIterator(
      node,
      4 //NodeFilter.SHOW_TEXT
    );
    let currentNode = iterator.nextNode() as Node;
    while (currentNode) {
      const text = currentNode.textContent;
      // const text = node.textContent;
      if (text) {
        const lines = text.split("\n");
        for (const [i, line] of lines.entries()) {
          const words = line
            .split(" ")
            .map((word) => word.toLowerCase().replace(cleanRegex, "").trim())
            .filter((word) => isWord.test(word));
          for (const [offset, word] of words.entries()) {
            for (const [j, term] of searchTerms.entries()) {
              if (word.includes(term)) {
                matches.push({
                  keyword: keywords[j],
                  word,
                  offset,
                  lineText: line,
                  lineIndex: i,
                  // node,
                  node: currentNode,
                });
              }
            }
          }
        }
      }
      currentNode = iterator.nextNode() as Node;
    }

    return matches;
  }

  public createFragmentProjection(fragment: Fragment): Projection {
    const extract = this.extractElement(fragment.element);
    const projection = {
      body: extract.html,
      css: extract.style,
      el: fragment.element,
    };
    if (fragment.element.tagName === "PRE") {
      const lineMatches: Array<{ lineIndex: number; lineText: string }> = [];
      for (const match of fragment.matches) {
        const line = lineMatches.find(
          (line) => line.lineIndex === match.lineIndex
        );
        if (!line) {
          lineMatches.push({
            lineIndex: match.lineIndex,
            lineText: match.lineText,
          });
        }
      }

      /** Shows select lines from a code block.
       *  Picks the first three lines that have at least one match.
       *  If the lines are not adjacent, adds ellipses between lines.
       */
      projection.body = `<pre id="PRE_1"><code id="CODE_1">${lineMatches
        .slice(0, 3)
        .map((match, i, matches) => {
          let line = match.lineText.trimStart();
          const nextMatch = matches[i + 1];
          if (nextMatch && nextMatch.lineIndex > match.lineIndex + 1) {
            line += `\n...`;
          }
          return line;
        })
        .join("\n")}</code></pre>`;
    }

    return projection;
  }

  public toJSON(): { blocks: Block[]; fragments: any[] } {
    return {
      blocks: this._blocks,
      fragments: this._fragments.map((f) => ({
        id: f.id,
        blockId: f.blockId,
        element: f.element.tagName.toLowerCase(),
        matches: f.matches.map((m) => ({
          lineIndex: m.lineIndex,
          offset: m.offset,
          word: m.word,
          lineText: m.lineText,
          keyword: m.keyword,
        })),
      })),
    };
  }

  public extractElement(element: HTMLElement): { html: string; style: string } {
    const snapshot = Snapshooter(element).replace(
      /:snappysnippet_prefix:/g,
      ""
    );
    const { html, css } = JSON.parse(snapshot);

    const cssStringifier = new (CSSStringifier as any)();
    const style = cssStringifier.process(css);

    return { html, style };
  }

  public static WithSelectionListener(
    listener: (action: "selectionchange", data: string) => void
  ): PageOption {
    return (p: Page): void => {
      let selectionTimerId: number;
      const onSelectionChange = () => {
        if (selectionTimerId) {
          clearTimeout(selectionTimerId);
        }
        selectionTimerId = setTimeout(() => {
          const selection = p.doc.getSelection();
          if (selection && !selection.isCollapsed) {
            listener("selectionchange", selection.toString());
          }
        }, 850) as unknown as number;
      };
      p.doc.addEventListener("selectionchange", onSelectionChange);
    };
  }

  public static WithCopyListener(
    listener: (action: "copy", data: string) => void
  ): PageOption {
    return (p: Page): void => {
      const onCopy = (event: KeyboardEvent) => {
        const selection = p.doc.getSelection();
        if (selection && !selection.isCollapsed) {
          const selectedText = selection.toString();
          if (event.key === "c" && (event.ctrlKey || event.metaKey)) {
            listener("copy", selectedText);
            // this.emit("copy", selectedText);
            // this._dom.removeEventListener("keydown", onCopy);
          }
        }
      };
      p.doc.addEventListener("keydown", onCopy);
    };
  }

  public static WithScrollListener(
    listener: (
      action: "scroll",
      data: {
        viewport: {
          x: number;
          y: number;
          height: number;
          width: number;
        };
        blocks: Block[];
      }
    ) => void
  ): PageOption {
    return (p: Page): void => {
      const win = p.doc.defaultView;
      let scrollTimerId: number;
      const onScroll = () => {
        if (scrollTimerId) {
          clearTimeout(scrollTimerId);
        }
        scrollTimerId = setTimeout(() => {
          const width = Math.max(
            p.doc.documentElement.clientWidth || 0,
            win?.innerWidth || 0
          );
          const height = Math.max(
            p.doc.documentElement.clientHeight || 0,
            win?.innerHeight || 0
          );
          const x = win?.scrollX ?? NaN;
          const y = win?.scrollY ?? NaN;
          const blocks = p.getBlocks();
          listener("scroll", { viewport: { x, y, height, width }, blocks });
        }, 500) as unknown as number;
      };

      p.doc.addEventListener("scroll", onScroll);
    };
  }
}
