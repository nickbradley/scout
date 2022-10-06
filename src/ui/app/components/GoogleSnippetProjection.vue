<template>
  <v-card-text
    ref="snippet"
    id="snippet"
    class="pa-0 d-inline"
    v-html="embelishedSnippet"
    @mouseup="onMouseup"
    @keydown.ctrl="onCopy"
    @keydown.meta="onCopy"
  ></v-card-text>
</template>

<script lang="ts">
import { Vue, Component, Prop } from "vue-property-decorator";

import * as Util from "../Util";

@Component()
export default class GoogleSnippetProjection extends Vue {
  @Prop() readonly snippet!: string;
  @Prop() readonly snippetHighlightWords!: string[];

  get embelishedSnippet(): string {
    const highlightWords = [...new Set(this.snippetHighlightWords)];
    let snippet = this.snippet;
    for (const word of highlightWords) {
      snippet = snippet.replaceAll(word, `<b>${word}</b>`);
    }
    return snippet;
  }

  onMouseup(): void {
    const selection = document.getSelection();
    if (selection && !selection.isCollapsed) {
      this.$emit("selectionchange", selection.toString());
    }
  }

  onCopy(event: KeyboardEvent): void {
    if (event.key === "c") {
      const selection = document.getSelection();
      if (selection && !selection.isCollapsed) {
        this.$emit("copy", selection.toString());
      }
    }
  }

  mounted(): void {
    const rect = this.$refs.snippet.getBoundingClientRect();
    const wc = Util.getWordCount(this.snippet);
    const lc = Util.getLineCount(this.snippet);
    this.$emit("load", { height: rect.height, width: rect.width, wc, lc });
  }
}
</script>

<style>
.v-card {
  text-align: initial;
}
</style>
