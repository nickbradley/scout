// https://help.bing.microsoft.com/#apex/bing/en-US/10001/-1
// https://help.bing.microsoft.com/#apex/bing/en-US/10002/-1
export default class BingSearchTerm {
  /**
   * Match term in webpage body.
   */
  inBody = false;
  /**
   * Match term in webpage title.
   */
  inTitle = false;
  /**
   * Adds emphasis to a search term.
   */
  prefer = false;
  /**
   * Prepends a + to the term.
   * Bing will ensure the results contain all of these terms.
   * Also allows you to include terms that are usually ignored.
   */
  required = false;
  /**
   * Surrounds term in double quotes.
   * Bing matches these terms exactly.
   */
  exact = false;

  constructor(public readonly keyword: string) {}

  toString(): string {
    let token = this.keyword;
    if (this.exact) {
      token = `"${this.keyword}"`;
    }
    if (this.required) {
      token = `+${token}`;
    }

    const operators: string[] = [];
    if (this.inBody) {
      operators.push(`inbody:${token}`);
    }
    if (this.inTitle) {
      operators.push(`intitle:${token}`);
    }
    if (this.prefer && !this.required) {
      operators.push(`prefer:${token}`);
    }

    return operators.join(" ") || token;
  }
}
