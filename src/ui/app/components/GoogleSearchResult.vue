<template>
  <v-card class="pa-1 pb-4" :elevation="0">
    <v-card-subtitle class="pa-0 black--text text-truncate">{{
      displayLink
    }}</v-card-subtitle>
    <!-- Add :href="url" to open link in browser --> 
    <v-card-title class="pa-0 d-block text-truncate" tag="a" @click="$emit('click', undefined, undefined);">{{
      title
    }}</v-card-title>
    <v-card-text v-if="extensions" class="pa-0">{{
      extensions.join(" · ")
    }}</v-card-text>
    <v-card-text
      id="snippet"
      class="pa-0"
      v-html="embelishedSnippet"
    ></v-card-text>
  </v-card>
</template>

<script lang="ts">
import { Vue, Component, Prop, Watch } from "vue-property-decorator";

@Component()
export default class GoogleSearchResult extends Vue {
  @Prop() readonly url!: string;
  @Prop() readonly title!: string;
  @Prop() readonly displayLink!: string;
  @Prop() readonly snippet!: string;
  @Prop() readonly date!: string;
  @Prop() readonly snippetHighlightWords!: string[];
  @Prop() readonly extensions!: string[];

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
