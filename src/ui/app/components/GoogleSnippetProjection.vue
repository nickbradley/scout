<template>
  <v-card-text
    id="snippet"
    class="pa-0"
    v-html="embelishedSnippet"
  ></v-card-text>
</template>

<script lang="ts">
import { Vue, Component, Prop } from "vue-property-decorator";

@Component()
export default class GoogleSnippetProjection extends Vue {
  @Prop() readonly url!: string;
  @Prop() readonly title!: string;
  @Prop() readonly displayLink!: string;
  @Prop() readonly snippet!: string;
  @Prop() readonly date!: string;
  @Prop() readonly snippetHighlightWords!: string[];
  @Prop() readonly extensions!: string[];

  dialog = false;

  get embelishedSnippet(): string {
    let embelishedSnippet = this.date
      ? this.date + " &mdash; " + this.snippet
      : this.snippet;

    const highlightWords = [...new Set(this.snippetHighlightWords)];

    for (const word of highlightWords) {
      embelishedSnippet = embelishedSnippet.replaceAll(
        word,
        "<b>" + word + "</b>"
      );
    }

    return embelishedSnippet;
  }
}
</script>

<style>
.v-card {
  text-align: initial;
}
</style>
