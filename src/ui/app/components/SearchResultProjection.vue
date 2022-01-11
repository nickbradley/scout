<template>
  <v-hover v-slot="{ hover }">
    <v-alert
      v-if="kind === 'fragment'"
      class="py-0 pr-0 mb-1"
      :elevation="hover ? 5 : 1"
      dense
      border="left"
      @click="onClick"
    >
      <iframe
        class="pa-0"
        :srcdoc="srcdoc"
        :style="'height:' + height + ';'"
        :class="dim ? 'dim' : ''"
      >
      </iframe>
    </v-alert>

    <iframe
      v-else
      class="pa-0"
      :srcdoc="srcdoc"
      :style="'height:' + height + ';'"
    >
    </iframe>
  </v-hover>
</template>

<script lang="ts">
/* eslint-disable no-useless-escape */

import { Component, Prop, Vue } from "vue-property-decorator";

export interface Projection {
  body: string;
  css: string;
  el: HTMLElement | null;
  kind?: "snippet" | "fragment";
}

@Component
export default class SearchResultProjection extends Vue implements Projection {
  @Prop() readonly body!: string;
  @Prop() readonly css!: string;
  @Prop() readonly el!: HTMLElement;
  @Prop({ default: "fragment" }) readonly kind!: "snippet" | "fragment";

  height = "150px;";

  window: Window | null = null;

  nonce = SearchResultProjection.getNonce();

  dim = false;

  get srcdoc(): string {
    return `
        <!doctype html>
        <html lang="en">
            <head>
                <meta charset="utf-8">
                <title></title>
                <style>${this.css}</style>
                <style>
                  body {
                    margin: 0 !important;
                    padding: 0 !important;
                    border: 0 !important;
                  }
                  pre {
                    margin: 0 !important;
                  }
                  p {
                    margin: 0 !important;
                  }
                </style>
                <script>
                  const sendAction = (action, data) => {
                      window.parent.postMessage({ nonce: "${this.nonce}", action, data }, "*");
                  }

                  window.addEventListener("resize", () => {
                    sendAction("resize", { height: document.body.offsetHeight, width: document.body.offsetWidth });
                  });

                  document.addEventListener("click", () => {
                    if (document.getSelection().isCollapsed) {
                      sendAction("click");
                    }
                  }, { once: false });

                  const onSelectionChange = () => {
                    const selection = document.getSelection();
                    if (!selection.isCollapsed) {
                      sendAction("selectionchange");
                      document.removeEventListener("selectionchange", onSelectionChange);
                    }
                  }
                  document.addEventListener("selectionchange", onSelectionChange);

                  const onCopy = (event) => {
                    const selection = document.getSelection();
                    if (selection && !selection.isCollapsed) {
                      const selectedText = selection.toString();
                      if (event.key === "c" && (event.ctrlKey || event.metaKey)) {
                        sendAction("copy", selectedText);
                        // this._dom.removeEventListener("keydown", onCopy);
                      }
                    }
                  }
                  document.addEventListener("keydown", onCopy);

                  window.addEventListener("DOMContentLoaded", () => {
                    // Disable hyperlinks
                    document.querySelectorAll("a").forEach((a) => a.onclick = function(event) {event.preventDefault();});
                    sendAction("loaded", { height: document.body.offsetHeight, width: document.body.offsetWidth });
                  });

                  window.addEventListener("message", (event) => {
                    if (event.data.nonce === "${this.nonce}") {
                      if (event.data.action === "clearSelections") {
                        window.getSelection().empty();
                      }
                    }
                  });
                </\script>
            </head>
            <body>
                ${this.body}
            </body>
        </html>
    `;
  }

  onClick(): void {
    // const dimmed = `p,pre {
    //                 color: #9d99c7 !important;
    //                 -webkit-text-fill-color: #9d99c7 !important;
    //               }`;
    // const doc = this.window.document;
    // const style = doc.createElement("style");
    // doc.head.appendChild(style);
    // style.appendChild(doc.createTextNode(dimmed));
    this.dim = true;
    this.$emit("click", undefined, this.el);
  }

  clearAllSections(): void {
    if (this.window) {
      this.window.postMessage(
        { nonce: this.nonce, action: "clearSelections" },
        "*"
      );
    }
  }

  created(): void {
    window.addEventListener("message", (event) => {
      if (event.data.nonce === this.nonce) {
        if (!this.window) {
          this.window = event.source as Window;
        }

        if (event.data.action === "loaded") {
          this.height = `${event.data.data.height}px`;
          const projectionBody = this.window.document.body;
          this.$emit("load", {
            text: projectionBody.innerText,
            html: projectionBody.innerHTML,
          });
        } else if (event.data.action === "resize") {
          this.height = `${event.data.data.height}px`;
        } else if (event.data.action === "click") {
          this.onClick();
        } else {
          this.$emit(event.data.action, event.data.data, this.el);
        }
      }
    });
  }

  private static getNonce(): string {
    let text = "";
    const possible =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }
}
</script>

<style scoped>
iframe {
  width: 100%;
  border: none;
  padding: 0;
  overflow: hidden;
}

.dim {
  opacity: 0.4;
}
</style>
