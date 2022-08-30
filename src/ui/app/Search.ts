import Page from "@/Page";
import CodeContext from "@/CodeContext";

export interface SearchProvider {
  fetch: (query: string) => Promise<Result[]>;
}

export interface SearchOptions {
  resultCount: number;
}

export interface Result {
  url: string;
  title: string;
  snippet: string;
  displayLink: string;
  page?: Page;

  date?: string;
  extensions?: string[];
  snippetHighlightWords: string[];
}

interface EventLog {
  timestamp: Date;
  url: string;
  component: "page" | "projection";
  action: string;
  data?: string | Record<string, unknown>;
}

export default class Search {
  readonly timestamp: Date;
  results?: Result[];
  events: EventLog[];

  constructor(
    readonly keywords: string[],
    public readonly context?: CodeContext
  ) {
    this.timestamp = new Date();
    this.events = [];
  }

  public get query(): string {
    const keywords = this.keywords;
    const lang = this.context?.languageName || "";
    const libs = this.context?.libraryNames ?? [];
    const calls = this.context?.callNames ?? [];
    // const sites = this.context.libraries
    //   .map((lib) => lib.docSites)
    //   .flat()
    //   .filter((site) => !["github.com"].includes(site))
    //   .map((site) => `site:${site}`)
    //   .concat("site:stackoverflow.com")
    //   .join(" OR ");
    const sites = "site:stackoverflow.com";
    return [lang, ...libs, ...keywords, ...calls, sites]
      .filter((item, pos, self) => self.indexOf(item) == pos)
      .join(" ")
      .trim();
  }

  public async getResults(
    provider: SearchProvider,
    query: string
  ): Promise<Result[]> {
    console.log("Serach::getResults(..) - ", query, provider);
    this.results = await provider.fetch(query);
    return this.results;
  }

  public logEvent(
    url: string,
    component: "page" | "projection",
    action: string,
    data?: string | Record<string, unknown>
  ): void {
    console.info(`[LOG]: ${action}, ${component}, ${url}, ${JSON.stringify(data)}`);
    const event: EventLog = {
      timestamp: new Date(),
      url,
      component,
      action,
      data,
    };
    this.events.push(event);
  }
}
