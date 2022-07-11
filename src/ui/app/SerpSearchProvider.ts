import ProxyRequest from "@/ProxyRequest";
import { Result, SearchOptions, SearchProvider } from "@/Search";

interface GoogleOrganicResult {
  position: number;
  title: string;
  link: string;
  displayed_link: string;
  snippet: string;
  snippet_highlighted_words: string[];
  date?: string;
  rich_snippet?: any;
}

export default class SerpSearchProvider implements SearchProvider {
  private static host = "https://serpapi.com";
  public resultCount: number;

  constructor(
    private readonly apiKey: string,
    private readonly searchOptions?: SearchOptions
  ) {
    this.resultCount = searchOptions?.resultCount ?? 5;
  }

  public async fetch(query: string): Promise<Result[]> {
    console.log("SerpSearchProvider::fetch(..) - ", query);
    if (!query) {
      return [];
    }
    const baseUrl = `${SerpSearchProvider.host}/search`;
    const engine = "google";
    const apiKey = this.apiKey;
    const q = encodeURIComponent(query);
    const num = this.resultCount;
    const url = `${baseUrl}?engine=${engine}&api_key=${apiKey}&num=${num}&q=${q}`;
    const res = await ProxyRequest.fetch(url);
    const data = await res.json();
    if (data.organic_results) {
      const organicResults = data.organic_results as GoogleOrganicResult[];
      return organicResults.map((or) => ({
        title: or.title,
        snippet: or.snippet,
        url: or.link,
        displayLink: or.displayed_link,
        snippetHighlightWords: or.snippet_highlighted_words,
        date: or?.date,
        extensions: or.rich_snippet?.top?.extensions,
      }));
    }
    return [];
  }
}
