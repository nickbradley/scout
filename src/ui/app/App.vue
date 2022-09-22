<template>
  <v-app style="background-color: transparent">
    <v-app-bar app tile flat dark>
      <v-spacer></v-spacer>
      <SearchBar
        id="input"
        ref="input"
        :history="searches"
        :context="context"
        :disabled="isSearchInProgress || searchDisabled"
        :loading="isSearchInProgress"
        :cache="searchCache"
        :value="searchValue"
        :demo="!wtDisable && wtStep === 0"
        :dedupResults="study.showSnippets"
        @search="onSearch"
        @reload="resetResults = true"
      ></SearchBar>
      <v-spacer></v-spacer>
      <template v-if="study.showContext" v-slot:extension>
        <ContextList
          id="context"
          :context="hostContext"
          :disabled="isSearchInProgress"
          @changed="onSelectedContextChanged"
        >
        </ContextList>
      </template>
    </v-app-bar>

    <v-main>
      <template v-if="results.length === 0">
        <v-container class="justify-center" fluid fill-height>
          <span v-if="search"
            >No results. This might be caused by a network timeout. Try your
            search again.</span
          >
          <span v-else>Enter some terms above to make a search.</span>
        </v-container>
      </template>

      <template v-else>
        <template v-if="!study.showSnippets">
          <SearchResult
            v-for="result of results"
            :key="result.url"
            v-bind="result"
            @mouseenter="
              () => search.logEvent(result.url, 'projection', 'mouseenter')
            "
            @mouseleave="
              () => search.logEvent(result.url, 'projection', 'mouseleave')
            "
            @open="(url) => openPage(url)"
          >
            <GoogleSnippetProjection
              :date="result.date"
              :snippet="result.snippet"
              :snippetHighlightWords="result.snippetHighlightWords"
              @copy="
                (data) =>
                  search.logEvent(result.url, 'projection', 'copy', data)
              "
              @selectionchange="
                (data) =>
                  search.logEvent(result.url, 'projection', 'selection', data)
              "
            ></GoogleSnippetProjection>
          </SearchResult>
        </template>

        <template v-else>
          <v-sheet class="mb-6 mx-1">
            <template v-if="display === 'list'">
              <SignatureListProjection
                :signatures="signatures"
                :codeTokens="codeTokens"
                :count="10"
                :loading="isSearchInProgress"
                @copy="
                  (rec, text) =>
                    search.logEvent('', 'projection', 'copy', {
                      sig: rec.text,
                      selection: text,
                    })
                "
                @expand="(sigText) => onSignatureExpand(undefined, sigText)"
                @mouseenter="
                  (rec) =>
                    search.logEvent('', 'projection', 'mouseenter', rec.text)
                "
                @mouseleave="
                  (rec) =>
                    search.logEvent('', 'projection', 'mouseleave', rec.text)
                "
                @open="(url, selector) => openPage(url, selector)"
                @selectionchange="
                  (rec, text) =>
                    search.logEvent('', 'projection', 'selection', {
                      sig: rec.text,
                      selection: text,
                    })
                "
              >
              </SignatureListProjection>
            </template>

            <template v-else>
              <SearchResult
                v-for="result of results"
                :key="result.url"
                v-bind="result"
                @mouseenter="
                  () => search.logEvent(result.url, 'projection', 'mouseenter')
                "
                @mouseleave="
                  () => search.logEvent(result.url, 'projection', 'mouseleave')
                "
                @open="(url) => openPage(url)"
              >
                <SignatureListProjection
                  :signatures="result.signatures"
                  :codeTokens="codeTokens"
                  :count="3"
                  :loading="result.areSignaturesLoading"
                  @copy="
                    (rec, text) =>
                      search.logEvent(result.url, 'projection', 'copy', {
                        sig: rec.text,
                        selection: text,
                      })
                  "
                  @expand="(sigText) => onSignatureExpand(result, sigText)"
                  @mouseenter="
                    (rec) =>
                      search.logEvent('', 'projection', 'mouseenter', rec.text)
                  "
                  @mouseleave="
                    (rec) =>
                      search.logEvent('', 'projection', 'mouseleave', rec.text)
                  "
                  @open="(url, selector) => openPage(result.url, selector)"
                  @selectionchange="
                    (rec, text) =>
                      search.logEvent(result.url, 'projection', 'selection', {
                        sig: rec.text,
                        selection: text,
                      })
                  "
                >
                </SignatureListProjection>
              </SearchResult>
            </template>
          </v-sheet>
          <v-footer fixed padless outlined>
            <v-toolbar v-show="results.length > 0" dense>
              <v-spacer></v-spacer>
              <v-btn
                icon
                :disabled="display === 'page' || isSearchInProgress"
                @click="() => changeResultLayout('page')"
              >
                <v-icon>mdi-select-group</v-icon>
              </v-btn>
              <v-btn
                icon
                :disabled="display === 'list' || isSearchInProgress"
                @click="() => changeResultLayout('list')"
              >
                <v-icon>mdi-view-list</v-icon>
              </v-btn>
            </v-toolbar>
          </v-footer>
        </template>
      </template>
    </v-main>

    <v-dialog
      v-model="dialog"
      fullscreen
      hide-overlay
      transition="slide-x-transition"
      :eager="false"
      @input="
        (open) => {
          if (!open) closePage();
        }
      "
    >
      <!-- HACK: Use "v-if" here to force element to rerender (and load the correct URL) -->
      <StackOverflowPage
        v-if="dialog"
        :url="displayUrl"
        :title="displayTitle"
        :focusedElement="displayFocusedElement"
        @close="closePage()"
        @copy="(text) => search.logEvent(displayUrl, 'page', 'copy', text)"
        @load="
          (url, doc, selector) => search.logEvent(url, 'page', 'load', selector)
        "
        @error="(url, err) => search.logEvent(url, 'page', 'error', err)"
        @scroll="(data) => search.logEvent(displayUrl, 'page', 'scroll', data)"
        @selectionchange="
          (text) => search.logEvent(displayUrl, 'page', 'selection', text)
        "
      ></StackOverflowPage>
    </v-dialog>
    <Walkthrough
      v-if="!wtDisable && wtStep <= 4 && wtShow"
      v-bind="walkthroughStep"
    ></Walkthrough>
  </v-app>
</template>

<script lang="ts">
import { Component, Vue, Watch } from "vue-property-decorator";
import SearchBar from "@/components/SearchBar.vue";
import ContextList from "@/components/ContextList.vue";
import SearchResult from "@/components/SearchResult.vue";
import Walkthrough from "@/components/Walkthrough.vue";
import GoogleSnippetProjection from "@/components/GoogleSnippetProjection.vue";
import SignatureListProjection from "@/components/SignatureListProjection.vue";
import StackOverflowPage from "@/components/StackOverflowPage.vue";

import Search, { Result } from "@/Search";
import CodeContext from "./CodeContext";

import {
  AppConfig,
  isImportToken,
  isFunctionCallToken,
  CodeToken,
} from "../../types";
import { resultsCache } from "./resultsCache";

interface AppEvent {
  timestamp: Date;
  name: string;
  data: Record<string, string | number>;
}

interface WalkthroughStep {
  attach: string | Node;
  top?: boolean;
  point?: boolean;
  title: string;
  text: string;
  action: string;
  progress: number;
}

interface TaskLogEntry {
  taskId: string;
  trialId: string;
  appEvents: AppEvent[];
  searches: Search[];
}

@Component({
  components: {
    ContextList,
    SearchBar,
    SearchResult,
    Walkthrough,
    GoogleSnippetProjection,
    SignatureListProjection,
    StackOverflowPage,
  },
})
export default class App extends Vue {
  study = {
    trialId: "",
    activeTask: "",
    showSnippets: true,
    showContext: false,
    contextOverride: [],
  };

  appEvents: AppEvent[] = [];

  config: AppConfig = {};

  // the SearchBar should emit these (they may include urls from sources like readmes)
  searches: Search[] = [];
  searchValue: string | null = null;
  searchCache: Record<string, Result[]> = {};
  searchDisabled = false;
  resetResults = false;

  codeTokens: CodeToken[] = [];
  // hostContext: CodeContext = new CodeContext();
  selectedContext: CodeContext | null = null;

  pagesToLoad = 0;

  resizeTimeoutId: number;

  wtShow = false;
  wtStep = 0;
  wtDisable = false;

  dialog = false;
  displayUrl = "";
  displayTitle = "";
  displayFocusedElement = "";

  display = "page";
  signatures = [];

  @Watch("log", { deep: true })
  async saveSearches(): Promise<void> {
    try {
      const content = JSON.stringify(this.log);
      await this.$host.saveFile(
        `scout.data.${this.study.activeTask || "na"}.json`,
        content
      );
    } catch (err) {
      // TODO provide real feedback
      console.warn("Failed to save search data.", err);
    }
  }

  get log(): TaskLogEntry {
    return {
      trialId: this.study.trialId,
      taskId: this.study.activeTask,
      appEvents: this.appEvents,
      searches: this.searches,
    };
  }

  get search(): Search {
    return this.searches[this.searches.length - 1];
  }

  get results(): Result[] {
    if (this.resetResults) {
      return [];
    } else {
      return this.search?.results ?? [];
    }
  }

  get context(): CodeContext {
    return this.selectedContext || this.hostContext;
  }

  get isSearchInProgress(): boolean {
    return this.pagesToLoad > 0;
  }

  get searchBox(): HTMLInputElement {
    return this.$refs.input.$el.querySelector<HTMLInputElement>("input");
  }

  get hostContext(): CodeContext {
    const context = this.codeTokens
      .filter((t) => isImportToken(t) || isFunctionCallToken(t))
      .map((t) => {
        if (isImportToken(t)) {
          return { kind: "library", value: t.module.name };
        } else {
          return { kind: "call", value: t.name };
        }
      });
    context.push({ kind: "language", value: "javascript" });
    return new CodeContext(context);
  }

  get walkthroughStep(): WalkthroughStep {
    const steps = [
      {
        attach: ".v-input__slot",
        title: "Search",
        text: "Search Google for Stack Overflow results.",
        action: "Type <code>sum object property array</code> and press Enter.",
        progress: 20,
      },
      {
        attach: ".v-expansion-panel-header",
        title: "Call Signatures",
        text: "Scout extracts call signatures from each Stack Overflow page. Types matching the source code are highlighted on hover.",
        action: "Click the signature to see example usages.",
        progress: 40,
      },
      {
        attach: ".v-expansion-panel-content .code-example",
        title: "Usage Examples",
        text: "Scout shows up to three example usages of the call signature from the Stack Overflow page.",
        action:
          "Click the <i class='v-icon notranslate mdi mdi-open-in-new theme--light'></i> button to open the Stack Overflow answer.",
        top: true,
        progress: 60,
      },
      {
        attach: ".close-dialog",
        title: "Full Page View",
        text: "The full Stack Overflow page is displayed scrolled to the answer containing the usage example (the bottom of the first code block).",
        action: "Click the X or press Esc to close the page.",
        progress: 80,
      },
      {
        attach: "div.v-list", //".code-example",
        title: "You're all set!",
        text: "You can use this example to complete the tutorial. Or explore the other signatures below.",
        action: "Click Next in the Task Instructions pane on the right.",
        closable: true,
        progress: 100,
      },
    ];
    return steps[this.wtStep];
  }

  openPage(url: string, selector: string): void {
    this.search.logEvent(url, "page", "open", selector);
    this.displayUrl = url;
    this.displayFocusedElement = selector;
    this.dialog = true;
    const resultIndex = this.results.findIndex(
      (res) => res.url === url && selector === "#answer-59730051"
    );
    if (resultIndex === 0 && this.wtStep === 2) {
      this.wtShow = false;
      setTimeout(() => {
        this.wtStep++;
        this.wtShow = true;
      }, 500);
    }
  }

  closePage(): void {
    this.search.logEvent(this.displayUrl, "page", "close");
    this.dialog = false;
    this.displayUrl = "";
    this.displayFocusedElement = "";

    if (this.wtStep === 3) {
      this.wtShow = false;
      this.wtStep++;
      this.$nextTick(() => (this.wtShow = true));
    }
  }

  changeResultLayout(layout: string): void {
    this.appEvents.push({
      timestamp: new Date(),
      name: "layout",
      data: {
        to: layout,
      },
    });
    this.display = layout;
  }

  onSelectedContextChanged(selectedContext: CodeContext): void {
    this.wtStep++;

    // TODO Log when context is changed??
    this.selectedContext = selectedContext;
  }

  async onSearch(searchPromise: Promise<Search>): Promise<void> {
    this.appEvents.push({
      timestamp: new Date(),
      name: "search",
      data: "search-start",
    });
    this.wtShow = false;
    this.signatures = [];

    try {
      this.resetResults = true;
      setTimeout(() => (this.pagesToLoad = 0), 12000);
      this.pagesToLoad = 1; // trigger loading indicator
      const search = await searchPromise;
      this.pagesToLoad = search.results.length;
      this.resetResults = false;

      search.results = search.results.map((result) => ({
        signatures: [],
        areSignaturesLoading: true,
        ...result,
      }));

      this.searches.push(search);

      if (this.study.showSnippets) {
        for (const result of search.results) {
          this.$host
            .getSignatures(result.url, search.query.split(" "))
            .then((signatures) => {
              result.signatures = signatures;
              this.signatures.push(...signatures);
            })
            .catch((err) => console.warn("Error retrieving signatures", err))
            .finally(() => {
              this.pagesToLoad--;
              result.areSignaturesLoading = false;
              search.logEvent(
                result.url,
                "projection",
                "loaded",
                `projection ${search.results.length - this.pagesToLoad} of ${
                  search.results.length
                }`
              );
              if (this.pagesToLoad === 0) {
                this.appEvents.push({
                  timestamp: new Date(),
                  name: "search",
                  data: "search-done",
                })
              }
              const resultIndex = this.results.findIndex(
                (res) => res.url === result.url
              );
              if (resultIndex === 0 && this.wtStep === 0) {
                setTimeout(() => {
                  this.wtStep++;
                  this.wtShow = true;
                }, 250);
              }
            });
        }
      } else {
        setTimeout(() => {
          this.pagesToLoad = 0;
          search.results.forEach((result, i) =>
            search.logEvent(
              result.url,
              "projection",
              "loaded",
              `projection ${search.results.length - i} of ${
                search.results.length
              }`
            )
          );
          this.appEvents.push({
            timestamp: new Date(),
            name: "search",
            data: "search-done",
          });
        }, 1200); // just for effect
      }
    } catch (err) {
      console.warn(err);
      this.appEvents.push({
        timestamp: new Date(),
        name: "search-error",
        data: {
          message: err.message,
        },
      });
      // We hit a timeout getting the results
      console.warn("Timeout getting results", err);
      this.pagesToLoad = 0;
    }
  }

  onSignatureExpand(result: Result, sigText: string): void {
    this.search.logEvent(result?.url || "", "projection", "expand", sigText);
    if (result) {
      const resultIndex = this.results.findIndex(
        (res) =>
          res.url === result.url && sigText === "T[].reduce(function, U): U"
      );
      if (resultIndex === 0 && this.wtStep === 1) {
        this.wtShow = false;
        this.wtStep++;
        this.$nextTick(() => (this.wtShow = true));
      }
    }
  }

  onAppResize(): void {
    if (this.resizeTimeoutId) {
      clearTimeout(this.resizeTimeoutId);
    }
    this.resizeTimeoutId = setTimeout(() => {
      this.appEvents.push({
        timestamp: new Date(),
        name: "resize",
        data: {
          height: window.innerHeight,
          width: window.innerWidth,
        },
      });
    }, 500);
  }

  async onAppFocus(): Promise<void> {
    console.log("App::onAppFocus()");

    let isNewTask = false;
    let isContextHidden = false;
    let context = new CodeContext();
    let activeTaskId = "";
    try {
      // For the study
      const trialConfig = await this.$host.readFile("./toast.data.json");
      const toastData = JSON.parse(trialConfig);
      this.study.trialId = toastData.id;
      activeTaskId = toastData.activeTaskId as string;
      if (activeTaskId !== this.study.activeTask) {
        this.dialog = false;
        this.$refs.input.reset();
        this.searches = [];
        this.appEvents = [];
        this.study.activeTask = activeTaskId;
        this.codeTokens = [];
        this.selectedContext = null;
        isNewTask = true;
      }
      if (activeTaskId === "tutorial") {
        this.wtDisable = false;
        this.wtShow = true;
      } else {
        this.wtDisable = true;
      }
      const treatment = toastData.tasks.find(
        (task) => task.id === activeTaskId
      );
      if (treatment) {
        this.study.showSnippets = treatment.enableFragments;
        this.study.showContext = treatment.showContext;
      }

      const actualTokens = (await this.$host.getContext()).tokens;
      console.log("ACTUAL TOKENS", actualTokens);
      const overrideTokens = treatment?.contextOverride || [];

      const tokens = actualTokens.length > 0 ? actualTokens : overrideTokens;
      if (JSON.stringify(tokens) !== JSON.stringify(this.codeTokens)) {
        console.log("UPDATING TOKENS", tokens);
        this.codeTokens = tokens;
      }

      if (treatment && treatment.searchTerms) {
        this.searchValue = treatment.searchTerms;
        // this.searchDisabled = true;
      }
    } catch (err) {
      this.appEvents.push({
        timestamp: new Date(),
        name: "focus-error",
        data: {
          message: err.message,
        },
      });
      console.warn(err);
    } finally {
      // Keep me in final version
      this.$nextTick(() => {
        this.searchBox.focus();
        this.searchBox.select();
      });

      const taskSourceFiles = {
        tutorial: "src/tutorial.js",
        currency: "src/currency.js",
        sort: "src/sort.js",
        clone: "src/clone.js",
        find: "src/find.js",
        recent: "src/recent.js",
        scrape: "src/scrape.js",
      };

      this.appEvents.push({
        timestamp: new Date(),
        name: "focus",
        data: {
          size: {
            height: window.innerHeight,
            width: window.innerWidth,
          },
          isNewTask,
          isContextHidden,
          isShowingSnippets: this.study.showSnippets,
          providedContext: context,
          sourceCode: await this.$host.getTokens(taskSourceFiles[activeTaskId]),
        },
      });
    }
  }

  async created(): Promise<void> {
    window.addEventListener("focus", this.onAppFocus);
    window.addEventListener("resize", this.onAppResize);
    window.addEventListener("message", async (event) => {
      const message = event.data as {
        sender: string;
        type: string;
        data: string;
      };
      if (message.sender === "vscode" && message.type === "search") {
        await this.onAppFocus();
        this.searchValue = message.data;

        this.appEvents.push({
          timestamp: new Date(),
          name: "search-link",
          data: {
            terms: message.data,
          },
        });
      }
    });
    this.searchCache = resultsCache;
    this.$host.signalReady();
  }

  async mounted(): Promise<void> {
    await this.onAppFocus();
    this.wtShow = true;
  }
}
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  /* margin-top: 60px; */
  height: 100vh;
  overflow-x: scroll;
}
.hidden {
  position: fixed;
  left: -200% !important;
}
.tooltip-bottom::before {
  border-right: solid 8px transparent;
  border-left: solid 8px transparent;
  transform: translateX(-50%);
  position: absolute;
  z-index: -21;
  content: "";
  bottom: 100%;
  left: 50%;
  height: 0;
  width: 0;
}

.tooltip-bottom.primary::before {
  border-bottom: solid 8px #246fb3;
}
</style>
