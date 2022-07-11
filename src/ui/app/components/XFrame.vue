<template>
  <iframe
    :sandbox="sandbox"
    :srcdoc="srcdoc"
    :style="'height: ' + height + '; width:' + width + ';'"
  ></iframe>
</template>

<script lang="ts">
/* eslint-disable no-useless-escape */

import { Vue, Component, Prop } from "vue-property-decorator";
import ProxyRequest, { FetchOptions } from "@/ProxyRequest";

interface FetchAndLoadOptions extends FetchOptions {
  loadTimeout: number;
}

@Component
export default class XFrame extends Vue {
  @Prop() readonly url!: string;
  @Prop({ default: "" }) readonly sandbox!: string;
  @Prop({ default: "100%" }) readonly height!: string;
  @Prop({ default: "100%" }) readonly width!: string;

  // Set when the component is loaded by fetch()
  private srcdoc = "";

  // Set to the iframe window once srcdoc is loaded
  private window?: Window;

  public static async fetch(
    url: string,
    options: FetchAndLoadOptions = {
      fetchTimeout: 10000,
      loadTimeout: 5000,
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 12_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
    }
  ): Promise<string> {
    const frameKillerHosts = [
      "developer.mozilla.org",
      "www.tabnine.com",
      "javascript.plainenglish.io",
    ];
    const res = await ProxyRequest.fetch(url, {
      fetchTimeout: options.fetchTimeout,
      userAgent: options.userAgent,
    });
    let text = await res.text();

    // Remove scripts from pages that try to kill the IFrame
    const host = new URL(url).host;
    if (frameKillerHosts.includes(host)) {
      const scriptRegex =
        /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script\s*>/gi;
      while (scriptRegex.test(text)) {
        text = text.replace(scriptRegex, "");
      }
    }

    // Modify the page <head>
    const pageContent = `<head$1>
          <base href="${url}">
          <script>
          console.log = function () { /* nop */ };
          console.info = function () { /* nop */ };
          console.warn = function () { /* nop */ };
          console.error = function () { /* nop */ };
          window.onerror = function() {
            /* nop */
            return true;
          }

          // X-Frame-Bypass navigation event handlers
          document.addEventListener('click', e => {
              if (frameElement && document.activeElement && document.activeElement.href) {
                  e.preventDefault()
                  frameElement.load(document.activeElement.href)
              }
          });
          document.addEventListener('submit', e => {
              if (frameElement && document.activeElement && document.activeElement.form && document.activeElement.form.action) {
                  e.preventDefault()
                  if (document.activeElement.form.method === 'post') {
                      frameElement.load(document.activeElement.form.action, {method: 'post', body: new FormData(document.activeElement.form)});
                  }else{
                      frameElement.load(document.activeElement.form.action + '?' + new URLSearchParams(new FormData(document.activeElement.form)));
                  }
              }
          });

          const loadTimeout = setTimeout(function () {
            window.stop();
            window.parent.postMessage({ url: "${url}", kind: "load-timeout" }, "*");
          }, ${options.loadTimeout});
          window.addEventListener("DOMContentLoaded", () => {
            clearTimeout(loadTimeout);
            window.parent.postMessage({ url: "${url}", kind: "loaded" }, "*");
          });
          <\/script>
    `;
    return text.replace(/<head([^>]*)>/i, pageContent);
  }

  async created(): Promise<void> {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.url === this.url) {
        if (event.data.kind === "loaded") {
          this.window = event.source as Window;
          this.$emit("loaded", this.url, this.window.document);
        } else {
          this.$emit(
            "error",
            this.url,
            `Timeout reached loading page ${this.url}`
          );
        }
        window.removeEventListener("message", handleMessage);
      }
    };

    window.addEventListener("message", handleMessage);

    try {
      this.srcdoc = await XFrame.fetch(this.url);
    } catch (err) {
      if (err instanceof DOMException) {
        this.$emit(
          "error",
          this.url,
          `Timeout reached fetching page ${this.url}`
        );
      } else {
        this.$emit("error", this.url, err.message);
      }
    }
  }
}
</script>

<style scoped></style>
