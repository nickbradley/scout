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
        @click="$emit('click', undefined, undefined)"
        >{{ title }}</v-card-title
      >
      <v-card-text v-if="extensions" class="pa-0">{{
        extensions.join(" · ")
      }}</v-card-text>
      <v-container v-if="!loaded">
        <v-spacer></v-spacer>
        <v-progress-circular
          indeterminate
          color="primary"
        ></v-progress-circular>
        <v-spacer></v-spacer>
      </v-container>
      <v-card-text v-else-if="displayRecommendations.length === 0">
        {{ "No recommendations found. " + loadError }}
      </v-card-text>
      <v-card-text v-else class="pa-0">
        <v-expansion-panels v-model="panel">
          <v-expansion-panel
            v-for="(rec, i) of displayRecommendations"
            :key="i"
          >
            <v-hover v-slot="{ hover }">
              <v-expansion-panel-header
                class="pa-0"
                color="rgba(0, 0, 0, 0.05)"
              >
                <v-tooltip bottom open-delay="300">
                  <template v-slot:activator="{ on, attrs }">
                    <v-icon
                      v-if="rec.metrics.isFromAcceptedAnswer"
                      small
                      v-bind="attrs"
                      v-on="on"
                      class="flex-grow-0"
                      >mdi-check</v-icon
                    >
                  </template>
                  <span>Accepted Answer</span>
                </v-tooltip>
                <v-tooltip bottom open-delay="300">
                  <template v-slot:activator="{ on, attrs }">
                    <v-icon
                      v-if="rec.metrics.isFromPopularAnswer"
                      small
                      v-bind="attrs"
                      v-on="on"
                      class="flex-grow-0"
                      >mdi-trending-up</v-icon
                    >
                  </template>
                  <span>Popular Answer</span>
                </v-tooltip>
                <v-tooltip bottom open-delay="300">
                  <template v-slot:activator="{ on, attrs }">
                    <v-icon
                      v-if="rec.metrics.isFromLatestAnswer"
                      small
                      v-bind="attrs"
                      v-on="on"
                      class="flex-grow-0"
                      >mdi-update</v-icon
                    >
                  </template>
                  <span>Recent Answer</span>
                </v-tooltip>

                <v-tooltip top open-delay="500">
                  <template v-slot:activator="{ on, attrs }">
                    <code
                      class="language-javascript pa-3 flex-grow-1 text-truncate"
                      style="background-color: transparent"
                      v-bind="attrs"
                      v-on="on"
                      >{{ rec.text }}
                    </code>
                  </template>
                  <span>{{ rec.text }}</span>
                </v-tooltip>

                <v-tooltip bottom open-delay="500">
                  <template v-slot:activator="{ on, attrs }">
                    <v-btn
                      v-show="hover"
                      icon
                      fab
                      fixed
                      right
                      elevation="0"
                      :ripple="false"
                      class="mr-3 pa-0"
                      width="48"
                      height="48"
                      @click.stop="openSignature(rec)"
                      v-bind="attrs"
                      v-on="on"
                      style="
                        background-color: rgba(210, 210, 210, 0.8) !important;
                      "
                    >
                      <v-icon>mdi-stack-overflow</v-icon>
                    </v-btn>
                  </template>
                  <span>Open Answer {{ rec.examples[0].answerId }}</span>
                </v-tooltip>
              </v-expansion-panel-header>
            </v-hover>
            <v-expansion-panel-content eager class="pa-0">
              <div v-if="rec.examples[0].declaration">
                declaration
                <pre><code class="language-javascript">{{rec.examples[0].declaration}}</code></pre>
              </div>
              call
              <pre><code class="language-javascript">{{rec.examples[0].call}}</code></pre>
            </v-expansion-panel-content>
          </v-expansion-panel>
        </v-expansion-panels>
      </v-card-text>
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
import Prism from "prismjs";
import "prismjs/themes/prism.css";
import "prismjs/components/prism-javascript";
import XFrame from "@/components/XFrame.vue";
import { Recommendation } from "@/Page";
import StackOverflowPage from "../StackOverflowPage";

@Component({
  components: { XFrame },
})
export default class SignatureSearchResult extends Vue {
  @Prop() readonly url!: string;
  @Prop() readonly title!: string;
  @Prop() readonly displayLink!: string;
  @Prop() readonly snippet!: string;
  @Prop() readonly date!: string;
  @Prop() readonly snippetHighlightWords!: string[];
  @Prop() readonly extensions!: string[];
  @Prop({
    default() {
      return [];
    },
  })
  readonly recommendations: Recommendation[];

  page?: StackOverflowPage;
  loaded = false;
  loadError = "";
  visible = false;
  dialog = false;
  panel = -1;

  openRecommendation: Recommendation;
  activeElement: HTMLElement;
  answerId: string;

  @Watch("recommendations")
  highlight(): void {
    this.loaded = true;
    setTimeout(() => Prism.highlightAll(), 250);
  }

  /**
   * Show the three most often used call signatures (after removing duplicate calls in the same answer)
   */
  get displayRecommendations(): Recommendation[] {
    return this.recommendations
      .slice()
      .sort((a, b) => {
        if (a.metrics.occurrences === b.metrics.occurrences) {
          if (a.metrics.isFromAcceptedAnswer) {
            return -1;
          } else if (b.metrics.isFromAcceptedAnswer) {
            return 1;
          }

          if (a.metrics.isFromPopularAnswer) {
            return -1;
          } else if (b.metrics.isFromPopularAnswer) {
            return 1;
          }

          if (a.metrics.isFromLatestAnswer) {
            return -1;
          } else if (b.metrics.isFromLatestAnswer) {
            return 1;
          }
        }

        return b.metrics.occurrences - a.metrics.occurrences;
      })
      .slice(0, 3);
  }

  get displayTitle(): string {
    return this.page ? this.page.title : this.title;
  }

  onPageLoaded(url: string, document: Document): void {
    document.querySelector("header")?.remove();
    document.querySelector("a[href='/questions/ask")?.parentElement?.remove();
    document.querySelector(".js-consent-banner")?.remove(); // cookie consent
    document.querySelector(".js-launch-popover-toggle")?.remove(); // remove sort option popover
    this.page = new StackOverflowPage(document);
    this.showAnswerOnPage();
  }

  onPageError(url: string, message: string): void {
    // // TODO Handle this problem (maybe display a "no recommendations found" message)
    // console.warn("App:onPageError", url, message);
    // this.loadError = message;
    // this.loaded = true;
  }

  openSignature(recommendation: Recommendation): void {
    this.dialog = true;
    this.answerId = recommendation.examples[0].answerId;
    this.showAnswerOnPage();
  }

  showAnswerOnPage(): void {
    if (this.page && this.answerId) {
      this.page.activeElement = this.page.doc.querySelector(
        `#answer-${this.answerId}`
      );
      this.page.highlightOnScroll();
      setTimeout(() => this.page.scrollToActiveElement(), 250);
    }
  }

  mounted(): void {
    window.Prism = window.Prism || {};
    window.Prism.manual = true;
    setTimeout(() => (this.loaded = true), 10000);
  }
}
</script>

<style scoped>
.hidden {
  position: fixed;
  left: -200% !important;
}

.v-btn {
  /* background-color: rgba(210, 210, 210, 0.8) !important; */
}

.v-progress-circular {
  display: block;
  width: 100px;
  margin: 0 auto;
}

.v-expansion-panel-content >>> .v-expansion-panel-content__wrap {
  padding: 0 !important;
  padding-right: 4px !important;
  padding-left: 4px !important;
}

/* .v-expansion-panel-header > *:not(.v-expansion-panel-header__icon) */

pre code {
  background-color: transparent !important;
  padding-right: 4px !important;
}
</style>
