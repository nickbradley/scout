import { Snapshooter, CSSStringifier } from "@/Snapshooter";
import Block from "@/Block";

interface TokenMatches {
  [token: string]: string[];
}

interface NodeMatch {
  node: Node;
  matches: TextMatch[];
}

// export type Match = TextMatch & { node: Node; line: number };

interface TextMatch {
  text: string;
  line: number;
  keywords: {
    [keyword: string]: Array<{
      word: string;
      offset: number;
    }>;
  };
}

export type KeywordMatches = Record<
  string,
  Array<{ word: string; offset: number }>
>;
export interface Fragment {
  node: Node;
  matches: Array<{
    text: string;
    line: number;
    keywords: KeywordMatches;
  }>;
}

// export interface Block {
//   identifier: string;
//   selector: string;
//   x?: number;
//   y?: number;
//   width?: number;
//   height?: number;
//   top?: number;
//   right?: number;
//   bottom?: number;
//   left?: number;
// }

export interface Projection {
  body: string;
  css: string;
  el: HTMLElement | null;
  kind?: "snippet" | "fragment";
}

export type PageOption = (p: Page) => void;

export default abstract class Page {
  public readonly title: string;

  constructor(readonly doc: Document, ...options: PageOption[]) {
    this.title = doc.title;

    for (const option of options) {
      option(this);
    }
  }

  public abstract getBlocks(): Block[];

  public toJSON(): any {
    return {
      blocks: this.getBlocks(),
    };
  }

  public createProjection(fragment: Fragment): Projection {
    const projection = {
      body: "",
      css: "",
      el: null,
    };
    const matches = fragment.matches;
    if (matches === null) {
      return projection;
    }
    let extract;
    const textElement = fragment.node.parentElement as HTMLElement;
    let el = textElement;
    if (textElement && textElement.tagName === "CODE") {
      const containingElement = textElement.parentElement;
      if (containingElement) {
        el = containingElement;
        extract = this.extractElement(containingElement);
        if (containingElement.tagName === "PRE") {
          console.log("FOUND CODE ELEMENT", matches);
          /** Shows select lines from a code block.
           *  Picks the first three lines that have at least one match.
           *  If the lines are not adjacent, adds ellipses between lines.
           */
          extract.html = `<pre id="PRE_1"><code id="CODE_1">${matches
            .slice(0, 3)
            .map((match, i, matches) => {
              let line = match.text.trimStart();
              const nextMatch = matches[i + 1];
              if (nextMatch && nextMatch.line > match.line + 1) {
                line += `\n...`;
              }
              return line;
            })
            .join("\n")}</code></pre>`;
        }
      }
    } else if (textElement && textElement.tagName === "P") {
      extract = this.extractElement(textElement);
    }
    projection.el = el as unknown as null;
    if (extract) {
      projection.body = extract.html;
      projection.css = extract.style;
    }
    return projection;
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

  // find(tokens: string[], root: Node): HTMLMatches[] {
  //   const matches: HTMLMatches[] = [];
  //   const iterator = this.doc.createNodeIterator(root, 0x00000001); // NodeFilter.SHOW_ELEMENT
  //
  //   let currentNode;
  //   // eslint-disable-next-line no-cond-assign
  //   while ((currentNode = iterator.nextNode() as HTMLElement)) {
  //     // const text = currentNode.innerText;
  //     const text = currentNode.textContent;
  //     if (text) {
  //       const textMatches = Page.findInText(text, tokens);
  //       if (Object.keys(textMatches).length > 0) {
  //         matches.push({ element: currentNode, matches: textMatches });
  //       }
  //     }
  //   }
  //
  //   return matches;
  // }

  find(tokens: string[], root: Node): NodeMatch[] {
    const matches: NodeMatch[] = [];
    const iterator = this.doc.createNodeIterator(root, NodeFilter.SHOW_TEXT);
    let currentNode = iterator.nextNode() as Node;
    while (currentNode) {
      const text = currentNode.textContent;
      if (text) {
        const textMatches = Page.findInText(text, tokens);
        if (Object.keys(textMatches).length > 0) {
          matches.push({ node: currentNode, matches: textMatches });
        }
      }
      currentNode = iterator.nextNode() as Node;
    }
    return matches;
  }

  static findInText(text: string, keywords: string[]): TextMatch[] {
    const matches: TextMatch[] = [];
    const lines = text.split("\n");
    const searchTerms = keywords.map((k) => k.toLowerCase());
    for (const [i, line] of lines.entries()) {
      const match = {
        text: line,
        line: i,
        keywords: {} as {
          [keyword: string]: Array<{
            word: string;
            offset: number;
          }>;
        },
      };
      const words = line.split(" ").map((word) => word.toLowerCase());
      for (const [offset, word] of words.entries()) {
        for (const term of searchTerms) {
          if (word.includes(term)) {
            const keywordMatch = match.keywords[term];
            if (keywordMatch) {
              keywordMatch.push({
                word,
                offset,
              });
            } else {
              match.keywords[term] = [
                {
                  word,
                  offset,
                },
              ];
            }
          }
        }
      }
      if (Object.keys(match.keywords).length > 0) {
        matches.push(match);
      }
    }
    return matches;
  }

  /*  findAlt(tokens: string[], root: Node): Fragment[] {
    const fragments: Fragment[] = [];
    const iterator = this.doc.createNodeIterator(root, NodeFilter.SHOW_TEXT);
    let currentNode = iterator.nextNode() as Node;
    while (currentNode) {
      const matches = [];
      const text = currentNode.textContent;
      if (text) {
        const lines = text.split("\n");
        for (const [i, line] of lines.entries()) {
          const keywordMatches = Page.findInText(line, tokens);
          if (Object.keys(keywordMatches).length > 0) {
            const match = {
              text: line,
              line: i,
              keywords: keywordMatches,
            };
            matches.push(match);
          }
        }
        fragments.push({ node: currentNode, matches });
      }
      currentNode = iterator.nextNode() as Node;
    }
    return fragments;
  }*/

  static findInTextAlt(text: string, keywords: string[]): KeywordMatches {
    const searchTerms = keywords.map((k) => k.toLowerCase());
    const matches: KeywordMatches = {};
    const words = text.split(" ").map((word) => word.toLowerCase());
    for (const [offset, word] of words.entries()) {
      for (const term of searchTerms) {
        if (word.includes(term)) {
          const keywordMatch = matches[term];
          if (keywordMatch) {
            keywordMatch.push({
              word,
              offset,
            });
          } else {
            matches[term] = [
              {
                word,
                offset,
              },
            ];
          }
        }
      }
    }
    return matches;
  }

  static findInText2(text: string, searchTokens: string[]): TokenMatches {
    const matches: TokenMatches = {};
    // searchTokens.forEach((t) => (matches[t] = []));
    const tokens = searchTokens.map((t) => t.toLowerCase());

    const words = text.split(" ");
    for (const word of words) {
      tokens.some((token, idx) => {
        const searchToken = searchTokens[idx];
        if (word.toLowerCase().includes(token)) {
          if (matches[searchToken]) {
            matches[searchToken].push(word);
          } else {
            matches[searchToken] = [word];
          }
        }
      });
    }
    return matches;
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
        }, 850);
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
        }, 500);
      };

      p.doc.addEventListener("scroll", onScroll);
    };
  }
}
