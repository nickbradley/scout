import fetch from "isomorphic-unfetch";

export interface FetchOptions {
  fetchTimeout: number;
  userAgent?: string;
}

export default class ProxyRequest {
  public static async fetch(
    url: string,
    options: FetchOptions = {
      fetchTimeout: 6000,
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 12_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
    }
  ): Promise<Response> {
    const pattern = new RegExp(
      /(https?:\/\/)?[\w\-~]+(\.[\w\-~]+)+(\/[\w\-~]*)*(#[\w-]*)?(\?.*)?/
    );
    if (!pattern.test(url)) {
      throw new Error("Invalid URL.");
    }

    const proxyUrl = "https://gentle-mountain-18560.herokuapp.com";
    const controller = new AbortController();
    const timerId = setTimeout(() => controller.abort(), options.fetchTimeout);
    // eslint-disable-next-line no-undef
    const init: RequestInit = {
      headers: {},
      signal: controller.signal,
    };
    if (options.userAgent) {
      init.headers = { "user-agent": options.userAgent, "x-requested-with": "XMLHttpRequest" };
    }
    const res = await fetch(`${proxyUrl}/${url}`, init);
    clearTimeout(timerId);
    return res;
  }
}
