<template>
  <v-card>
    <v-toolbar dark color="primary">
      <v-btn class="close-dialog" icon dark @click="closePage()">
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
</template>

<script lang="ts">
import { Vue, Component, Prop } from "vue-property-decorator";
import XFrame from "@/components/XFrame.vue";
import Page from "@/Page";
import StackOverflowPage from "@/StackOverflowPage";

@Component({
  components: { XFrame },
})
export default class SearchResult extends Vue {
  @Prop() readonly url!: string;
  @Prop() readonly title!: string;
  @Prop() readonly focusedElement!: string;

  page = null;

  get displayTitle(): string {
    return this.page ? this.page.title : this.title;
  }

  onPageLoaded(url: string, document: Document): void {
    document.querySelector("header")?.remove();
    document.querySelector("a[href='/questions/ask")?.parentElement?.remove();
    document.querySelector(".js-consent-banner")?.remove(); // cookie consent
    document.querySelector(".js-launch-popover-toggle")?.remove(); // remove sort option popover
    const emitter = (action: string, data?: string | Record<string, unknown>) =>
      this.$emit(action, data);
    this.page = new StackOverflowPage(
      document,
      Page.WithCopyListener(emitter),
      Page.WithScrollListener(emitter),
      Page.WithSelectionListener(emitter)
    );
    this.scrollToElement();
    this.$emit("load", url, document, this.focusedElement);
  }

  onPageError(url: string, message: string): void {
    this.$emit("error", url, message);
  }

  closePage(): void {
    this.page?.clearHighlighOnScroll();
    this.$emit("close", this.url);
  }

  scrollToElement(): void {
    if (this.page && this.focusedElement) {
      this.page.activeElement = this.page.doc.querySelector(
        this.focusedElement
      );
      this.page.highlightOnScroll();
      setTimeout(() => this.page.scrollToActiveElement(), 250);
    }
  }
}
</script>
