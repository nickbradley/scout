<template>
  <v-container class="pa-0">
    <v-card class="pa-1 pb-4" :elevation="0">
      <v-card-subtitle class="pa-0 black--text text-truncate">{{
        displayLink
      }}</v-card-subtitle>
      <!-- Add :href="url" to open link in browser -->
      <v-card-title
        class="pa-0 d-block text-truncate"
        tag="a"
        @click="openPage()"
        >{{ title }}</v-card-title
      >
      <v-card-text v-if="extensions" class="pa-0">{{
        extensions.join(" · ")
      }}</v-card-text>
      <slot>
        <SignatureProjection
          v-if="projectionType === 'signature'"
          :url="url"
          @open="openPageToAnswer"
        >
        </SignatureProjection>
        <GoogleSnippetProjection
          v-else
          :date="date"
          :snippet="snippet"
          :snippetHighlightWords="snippetHighlightWords"
        ></GoogleSnippetProjection>
      </slot>
    </v-card>

    <v-dialog
      v-model="dialog"
      fullscreen
      hide-overlay
      transition="slide-x-transition"
      :eager="false"
    >
      <v-card>
        <v-toolbar dark color="primary">
          <v-btn icon dark @click="dialog = false">
            <v-icon>mdi-close</v-icon>
          </v-btn>
          <v-tooltip bottom>
            <template v-slot:activator="{ on, attrs }">
              <v-toolbar-title v-bind="attrs" v-on="on">{{
                displayTitle
              }}</v-toolbar-title>
            </template>
            <span>{{ displayTitle }}</span>
          </v-tooltip>
          <v-spacer></v-spacer>
        </v-toolbar>
        <v-container fluid style="height: calc(100vh - 56px)" class="pa-0">
          <v-layout fill-height>
            <XFrame
              sandbox="allow-scripts allow-same-origin"
              :url="url"
              @loaded="onPageLoaded"
              @error="onPageError"
              style="height: 100%"
            >
            </XFrame>
          </v-layout>
        </v-container>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script lang="ts">
import { Vue, Component, Prop, Watch } from "vue-property-decorator";
import XFrame from "@/components/XFrame.vue";
import StackOverflowPage from "@/StackOverflowPage";
import GoogleSnippetProjection from "@/components/GoogleSnippetProjection.vue";
import SignatureProjection from "@/components/SignatureProjection.vue";

@Component({
  components: { XFrame, GoogleSnippetProjection, SignatureProjection },
})
export default class SearchResult extends Vue {
  @Prop() readonly url!: string;
  @Prop() readonly title!: string;
  @Prop() readonly displayLink!: string;
  @Prop() readonly snippet!: string;
  @Prop() readonly date!: string;
  @Prop() readonly snippetHighlightWords!: string[];
  @Prop() readonly extensions!: string[];

  @Prop({ default: "snippet" }) readonly projectionType!:
    | "snippet"
    | "signature";

  dialog = false;

  answerIdToHighlight?: number;

  get displayTitle(): string {
    return this.page ? this.page.title : this.title;
  }

  onPageLoaded(url: string, document: Document): void {
    document.querySelector("header")?.remove();
    document.querySelector("a[href='/questions/ask")?.parentElement?.remove();
    document.querySelector(".js-consent-banner")?.remove(); // cookie consent
    document.querySelector(".js-launch-popover-toggle")?.remove(); // remove sort option popover
    this.page = new StackOverflowPage(document);
    if (this.answerIdToHighlight) {
      this.scrollToAnswer(this.answerIdToHighlight);
      this.answerIdToHighlight = undefined;
    }
    // this.showAnswerOnPage();
  }

  onPageError(url: string, message: string): void {
    // // TODO Handle this problem (maybe display a "no recommendations found" message)
    // console.warn("App:onPageError", url, message);
    // this.loadError = message;
    // this.loaded = true;
  }

  @Watch("dialog")
  closePage(): void {
    console.log("dialog is now", this.dialog);
    if (!this.dialog) {
      this.page?.clearHighlighOnScroll();
    }
  }

  openPage(): void {
    this.answerIdToHighlight = undefined;
    this.dialog = true;
  }

  openPageToAnswer(answerId: number): void {
    this.openPage();
    this.answerIdToHighlight = answerId;
    this.scrollToAnswer(answerId);
  }

  scrollToAnswer(answerId: number): void {
    if (this.page) {
      this.page.activeElement = this.page.doc.querySelector(
        `#answer-${answerId}`
      );
      this.page.highlightOnScroll();
      setTimeout(() => this.page.scrollToActiveElement(), 250);
    }
  }
}
</script>

<style scoped>
.v-card {
  text-align: initial;
}
</style>
