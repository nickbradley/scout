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
  page?: Page;
}

interface EventLog {
  timestamp: Date;
  url: string;
  component: "page" | "projection";
  action: string;
  data?: string | Record<string, unknown>;
}

export default class Search {
  query?: string;
  results?: Result[];
  events: EventLog[];

  constructor(
    readonly keywords: string[],
    public readonly context?: CodeContext
  ) {
    this.events = [];
  }

  public async getResults(
    provider: SearchProvider,
    query: string
  ): Promise<Result[]> {
    console.log("Serach::getResults(..) - ", query, provider);
    this.query = query;
    this.results = await provider.fetch(query);
    return this.results;
  }

  public logEvent(
    url: string,
    component: "page" | "projection",
    action: string,
    data?: string | Record<string, unknown>
  ): void {
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
