import fetch from "isomorphic-unfetch";
import { SearchProvider, Result } from "@/Search";

interface Webpage {
  id: string;
  name: string;
  url: string;
  displayUrl: string;
  snippet: string;
  dateLastCrawled: string;
}

interface WebpagesAnswer {
  webSearchUrl: string;
  totalEstimatedMatches: number;
  value: Webpage[];
}

interface SearchResponse {
  webPages: WebpagesAnswer;
}

export default class BingSearchProvider implements SearchProvider {
  private readonly _apiKey: string;

  constructor(apiKey: string) {
    this._apiKey = apiKey;
  }

  public async fetch(query: string, count = 5): Promise<Result[]> {
    console.log("BingSearchProvider::fetch(..) - Query:", query);
    if (!query) {
      return [];
    }
    const offset = 0;
    const mkt = "en-CA";
    const url = `https://api.bing.microsoft.com/v7.0/search?count=${count}&q=${query}`;
    // Options: https://docs.microsoft.com/en-us/bing/search-apis/bing-web-search/search-the-web
    const options: RequestInit = {
      headers: {
        "Ocp-Apim-Subscription-Key": this._apiKey,
      },
    };
    const response = await fetch(encodeURI(url), options);
    const data: SearchResponse = await response.json();
    if (data.webPages) {
      return data.webPages.value.map((page) => ({
        title: page.name,
        snippet: page.snippet,
        url: page.url,
      }));
    } else {
      return [];
    }
  }
}
