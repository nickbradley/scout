import fetch from "isomorphic-unfetch";

export interface FetchOptions {
  fetchTimeout?: number;
  userAgent?: string;
  requestedWith?: string;
}

export default class ProxyRequest {
  public static async fetch(
    url: string,
    options: FetchOptions = {}
  ): Promise<Response> {
    const pattern = new RegExp(
      /(https?:\/\/)?[\w\-~]+(\.[\w\-~]+)+(\/[\w\-~]*)*(#[\w-]*)?(\?.*)?/
    );
    if (!pattern.test(url)) {
      throw new Error("Invalid URL.");
    }
    const defaultOptions = {
      fetchTimeout: 6000,
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 12_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
    };
    const proxyUrl = "https://gentle-mountain-18560.herokuapp.com";
    const controller = new AbortController();
    // eslint-disable-next-line no-undef
    const init: RequestInit = {
      headers: {
        "user-agent": options.userAgent ?? defaultOptions.userAgent,
      },
      signal: controller.signal,
    };

    if (options.requestedWith) {
      Object.assign(init.headers!, { "x-requested-with": options.requestedWith });
    }
    const timerId = setTimeout(() => controller.abort(), options.fetchTimeout ?? defaultOptions.fetchTimeout);
    const res = await fetch(`${proxyUrl}/${url}`, init);
    clearTimeout(timerId);
    return res;
  }
}
