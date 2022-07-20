<template>
  <v-card-text
    id="snippet"
    class="pa-0 d-inline"
    v-html="embelishedSnippet"
  ></v-card-text>
</template>

<script lang="ts">
import { Vue, Component, Prop } from "vue-property-decorator";

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
}
</script>

<style>
.v-card {
  text-align: initial;
}
</style>
