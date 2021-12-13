type Term = string;
interface KeywordOptions {
  /**
   * Match term in webpage body.
   */
  inBody: boolean;
  /**
   * Match term in webpage title.
   */
  inTitle: boolean;
  /**
   * Surrounds term in double quotes.
   * Bing matches these terms exactly.
   */
  exact: boolean;
  /**
   * Adds emphasis to a search term.
   */
  prefer: boolean;
  /**
   * Prepends a + to the term.
   * Bing will ensure the results contain all of these terms.
   * Also allows you to include terms that are usually ignored. */
  required: boolean;
}

export default class BingSearch {
  private readonly _keywords: Array<[string, KeywordOptions]>;
  private readonly sites: string[];

  constructor() {
    this._keywords = [];
    this.sites = [];
  }

  get keywords(): string[] {
    return this._keywords.map(([text, _]) => text);
  }

  addKeyword(
    keyword: string,
    options: KeywordOptions = {
      inBody: false,
      inTitle: false,
      prefer: false,
      exact: false,
      required: false,
    }
  ): void {
    this._keywords.push([keyword, options]);
  }

  setSite(host: string): void {
    this.sites.push(host);
  }

  build(): string {
    let query = "";

    for (const site of this.sites) {
      query += `site:${site} `;
    }

    for (const [keyword, options] of this._keywords) {
      const term = BingSearch.applyKeywordOptions(keyword, options);
      query += `${term} `;
    }

    return query.trimEnd();
  }

  private static applyKeywordOptions(
    keyword: string,
    options: KeywordOptions
  ): Term {
    let token = keyword;
    if (options.exact) {
      token = `"${keyword}"`;
    }
    if (options.required) {
      token = `+${token}`;
    }

    const operators: string[] = [];
    if (options.inBody) {
      operators.push(`inbody:${token}`);
    }
    if (options.inTitle) {
      operators.push(`intitle:${token}`);
    }
    if (options.prefer && !options.required) {
      operators.push(`prefer:${token}`);
    }

    return operators.join(" ");
  }
}
