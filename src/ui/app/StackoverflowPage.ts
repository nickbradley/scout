import Page, { Fragment, PageOption, Projection } from "./Page";
import Block from "@/Block";

// const isHTMLElement = (element: HTMLElement | null): element is HTMLElement => {
//   return (element as HTMLElement) !== null;
// };

export default class StackoverflowPage extends Page {
  constructor(readonly doc: Document, ...options: PageOption[]) {
    super(doc, ...options);
  }

  public getBlocks(): Block[] {
    const answers = Array.from(
      this.doc.querySelectorAll<HTMLDivElement>(".answer")
    );
    return answers.map(
      (answer) =>
        new Block(
          answer.dataset.answerid || "",
          answer.querySelector(".s-prose") as HTMLElement
        )
    );
  }

  public getBlockFragments(block: Block, keywords: string[]): Fragment[] {
    block.fragments = this.find(keywords, block.element);
    return block.fragments;
  }

  public sortFragments(fragments: Fragment[]): Fragment[] {
    return fragments
      .map((fragment) => {
        // Count of ALL tokens found within the fragment (even duplicates)
        const matchCount = fragment.matches.reduce(
          (matchCount, textMatch) =>
            matchCount + Object.values(textMatch.keywords).flat().length,
          0
        );
        // const matchCount = Object.values(fragment.keywords).flat().length;
        return { fragment, matchCount };
      })
      .sort((a, b) => b.matchCount - a.matchCount)
      .map(({ fragment }) => fragment);
  }

  public sortBlocks(blocks: Block[]): Block[] {
    return blocks;
  }

  // public getProjections(fragments: HTMLElement[]): Projection[] {
  //   fragments.map((fragment) => {
  //     let extract: string;
  //     if (fragment.tagName === "CODE") {
  //       const containingElement = fragment.parentElement;
  //       if (containingElement) {
  //         el = containingElement;
  //         extract = this.extractElement(containingElement);
  //         if (containingElement.tagName === "PRE") {
  //           /** Shows select lines from a code block.
  //            *  Picks the first three lines that have at least one match.
  //            *  If the lines are not adjacent, adds ellipses between lines.
  //            */
  //           extract.html = `<pre id="PRE_1"><code id="CODE_1">${matches
  //             .slice(0, 3)
  //             .map((match, i, matches) => {
  //               let line = match.text.trimStart();
  //               const nextMatch = matches[i + 1];
  //               if (nextMatch && nextMatch.line > match.line + 1) {
  //                 line += `\n...`;
  //               }
  //               return line;
  //             })
  //             .join("\n")}</code></pre>`;
  //         }
  //       }
  //     } else if (textElement && textElement.tagName === "P") {
  //       extract = this.extractElement(textElement);
  //     }
  //     if (extract) {
  //       return {
  //         body: extract.html,
  //         css: extract.style,
  //         el,
  //       };
  //     } else {
  //       return { body: "", css: "", el };
  //     }
  //   });
  //   const x = Array.from(
  //     this.doc.querySelectorAll<HTMLElement>(".answer .s-prose")
  //   )
  //     .map((answer) => {
  //       return this.find(keywords, answer)
  //         .map(({ node, matches }) => {
  //           // Count of ALL tokens found within the match element (even duplicates)
  //           const matchCount = matches.reduce(
  //             (matchCount, textMatch) =>
  //               matchCount + Object.values(textMatch.keywords).flat().length,
  //             0
  //           );
  //           return { node, matches, matchCount };
  //         })
  //         .sort((a, b) => a.matchCount - b.matchCount)
  //         .map(({ node, matches }) => {
  //           let extract;
  //           const textElement = node.parentElement;
  //           let el = textElement;
  //           if (textElement && textElement.tagName === "CODE") {
  //             const containingElement = textElement.parentElement;
  //             if (containingElement) {
  //               el = containingElement;
  //               extract = this.extractElement(containingElement);
  //               if (containingElement.tagName === "PRE") {
  //                 /** Shows select lines from a code block.
  //                  *  Picks the first three lines that have at least one match.
  //                  *  If the lines are not adjacent, adds ellipses between lines.
  //                  */
  //                 extract.html = `<pre id="PRE_1"><code id="CODE_1">${matches
  //                   .slice(0, 3)
  //                   .map((match, i, matches) => {
  //                     let line = match.text.trimStart();
  //                     const nextMatch = matches[i + 1];
  //                     if (nextMatch && nextMatch.line > match.line + 1) {
  //                       line += `\n...`;
  //                     }
  //                     return line;
  //                   })
  //                   .join("\n")}</code></pre>`;
  //               }
  //             }
  //           } else if (textElement && textElement.tagName === "P") {
  //             extract = this.extractElement(textElement);
  //           }
  //           if (extract) {
  //             return {
  //               body: extract.html,
  //               css: extract.style,
  //               el,
  //             };
  //           } else {
  //             return { body: "", css: "", el };
  //           }
  //         })[0];
  //     })
  //     .filter((proj) => proj !== undefined && proj.body);
  //   return x;
  // }
}
