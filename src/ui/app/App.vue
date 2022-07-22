<template>
  <v-app style="background-color: transparent">
    <v-app-bar app tile flat dark>
      <v-spacer></v-spacer>
      <SearchBar
        id="input"
        ref="input"
        :history="searches"
        :context="context"
        :disabled="
          isSearchInProgress || visibleResult !== null || searchDisabled
        "
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
          :disabled="isSearchInProgress || visibleResult !== null"
          @changed="onSelectedContextChanged"
        >
        </ContextList>
      </template>
    </v-app-bar>

    <v-main>
      <v-container
        v-if="results.length === 0"
        class="justify-center"
        fluid
        fill-height
      >
        <span v-if="search"
          >No results. This might be caused by a network timeout. Try your
          search again.</span
        >
        <span v-else>Enter some terms above to make a search.</span>
      </v-container>
      <!-- <SearchResult
        v-for="result of loadedResults"
        :key="result.url"
        v-bind="result"
        :snippet="study.showSnippets ? result.snippet : ''"
        :keywords="[
          ...search.keywords,
          ...(search.context.libraryNames || []),
          ...(search.context.callNames || []),
        ]"
        @open="() => openResult(result)"
        @click="
          (el, index) => {
            search.logEvent(result.url, 'projection', 'click', {
              projection: index,
            });
            onResultProjectionClick(result, el);
          }
        "
        @select="
          (data) => search.logEvent(result.url, 'projection', 'select', data)
        "
        @copy="
          (data) => search.logEvent(result.url, 'projection', 'copy', data)
        "
        @load="(blocks) => onResultLoaded(result, blocks)"
      ></SearchResult> -->
      <div v-for="result of results" :key="result.url">
        <SearchResult
          v-bind="result"
          :projectionType="study.showSnippets ? 'signature' : 'snippet'"
          @close="() => onResultClose(result)"
          @copy="
            (data) => search.logEvent(result.url, 'projection', 'copy', data)
          "
          @copy-page="
            (data) => search.logEvent(result.url, 'page', 'copy', data)
          "
          @load-error="(err) => onResultLoadError(result, err)"
          @expand="(data) => onSearchResultExpand(result, data)"
          @load="(data) => onResultLoaded(result, data)"
          @open="(data) => onProjectionOpen(result, data)"
          @open-page="() => search.logEvent(result.url, 'page', 'open')"
          @scroll-page="
            (data) => search.logEvent(result.url, 'page', 'scroll', data)
          "
          @selectionchange="
            (data) =>
              search.logEvent(result.url, 'projection', 'selection', data)
          "
          @selectionchange-page="
            (data) => search.logEvent(result.url, 'page', 'selection', data)
          "
        ></SearchResult>
      </div>
    </v-main>

    <Walkthrough
      v-if="!wtDisable && wtStep <= 4 && wtShow"
      :value="wtShow"
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

import Search, { Result } from "@/Search";
import Page from "@/Page";
import StackOverflowPage from "@/StackOverflowPage";
import CodeContext from "@/CodeContext";
import { AppConfig } from "../../common/types";
import { resultsCache } from "./resultsCache";

import WorkerPool from "@/WorkerPool";

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

@Component({
  components: {
    ContextList,
    SearchBar,
    SearchResult,
    Walkthrough,
  },
})
export default class App extends Vue {
  workerPool: WorkerPool;
  study = {
    trialId: "",
    activeTask: "",
    showSnippets: true,
    showContext: false,
  };

  appEvents: AppEvent[] = [];

  config: AppConfig = {};

  // the SearchBar should emit these (they may include urls from sources like readmes)
  searches: Search[] = [];
  searchValue: string | null = null;
  searchCache: Record<string, Result[]> = {};
  searchDisabled = false;
  resetResults = false;

  hostContext: CodeContext = new CodeContext();
  selectedContext: CodeContext | null = null;

  visibleResult: Result | null = null;

  pagesToLoad = 0;

  resizeTimeoutId: number;

  wtShow = false;
  wtStep = 0;
  wtDisable = false;

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

  get log(): any {
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

  get loadedResults(): Result[] {
    const res = this.results; //.filter((result) => result.page);
    // console.log("*************", res);
    return res;
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

  get walkthroughStep(): WalkthroughStep {
    const steps = [
      {
        attach: ".v-select__slot",
        title: "Search",
        text: "Search Google for Stack Overflow results.",
        action: 'Type "sum object property array" and press Enter.',
        progress: 20,
      },
      {
        attach: ".v-expansion-panel-header",
        title: "Call Signatures",
        text: "Scout extracts call signatures from the Stack Overflow answers.",
        action: "Click the signature to see usages.",
        progress: 40,
      },
      {
        attach: ".code-example",
        title: "Usage Examples",
        text: "Scout shows example usages of the call signature from the Stack Overflow page.",
        action: "Mouse over the code and click the Stack Overflow button.",
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
        attach: ".code-example",
        title: "You're all set!",
        text: "You can use this example to complete the tutorial. Or explore the other signatures below.",
        action: "Click Next in the Task Instructions pane on the right.",
        progress: 100,
      },
    ];
    return steps[this.wtStep];
  }
  onSelectedContextChanged(selectedContext: CodeContext): void {
    this.wtStep++;

    // TODO Log when context is changed??
    this.selectedContext = selectedContext;
  }

  async onSearch(searchPromise: Promise<Search>): Promise<void> {
    this.wtShow = false;

    try {
      this.resetResults = true;
      setTimeout(() => (this.pagesToLoad = 0), 12000);
      this.pagesToLoad = 1; // trigger loading indicator
      const search = await searchPromise;
      this.pagesToLoad = search.results.length;
      this.resetResults = false;
      // this.pagesToLoad = search.results?.length ?? 0;
      this.searches.push(search);
    } catch (err) {
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

  onPageLoaded(url: string, document: Document): void {
    console.log("App::onPageLoaded", url);
    const result = this.results?.find((r) => r.url === url);
    if (result) {
      const logger = (
        action: string,
        data?: string | Record<string, unknown>
      ) => this.search.logEvent(url, "page", action, data);
      let page: Page;
      const hostname = new URL(url).hostname;
      switch (hostname) {
        case "stackoverflow.com": {
          page = new StackOverflowPage(
            document,
            Page.WithCopyListener(logger),
            Page.WithScrollListener(logger),
            Page.WithSelectionListener(logger)
          );
          break;
        }
      }
      // const page = new Page(
      //   document,
      //   Page.WithCopyListener(logger),
      //   Page.WithScrollListener(logger),
      //   Page.WithSelectionListener(logger)
      // );
      if (page) {
        this.$set(result, "page", page);
        this.search.logEvent(url, "page", "loaded");
      }
      this.pagesToLoad -= 1;
    }
  }

  onPageError(url: string, message: string): void {
    console.warn("App:onPageError", message);
    this.search.logEvent(url, "page", "load-error", message);
    this.pagesToLoad -= 1;
  }

  onResultLoaded(result: Result, data: unknown): void {
    this.pagesToLoad--;
    this.search.logEvent(result.url, "projection", "load", data);
    const resultIndex = this.results.findIndex((res) => res.url === result.url);
    if (resultIndex === 0) {
      setTimeout(() => {
        this.wtShow = true;
        this.wtStep++;
      }, 250);
    }
  }

  onResultLoadError(result: Result, err: Error): void {
    this.pagesToLoad--;
    this.search.logEvent(result.url, "projection", "error", err);
    console.warn("Failed to get signatures from", this.url, ".", err);
  }

  onResultClose(result: Result): void {
    this.search.logEvent(result.url, "page", "close");
    this.wtStep++;
  }

  onSearchResultExpand(result: Result, data: unknown): void {
    this.search.logEvent(result.url, "projection", "expand", data);
    this.wtStep++;
  }

  onProjectionOpen(result: Result, data: unknown): void {
    this.search.logEvent(result.url, "projection", "open", data);
    this.wtShow = false;
    setTimeout(() => {
      this.wtStep++;
      this.wtShow = true;
    }, 1500);
  }

  onResultProjectionClick(result: Result, pageElement: HTMLElement): void {
    this.openResult(result);
    result.page.activeElement = pageElement;
    pageElement.scrollIntoView({ block: "center", inline: "center" });
    // pageElement.classList.add("fade-in");
    // setTimeout(() => pageElement.classList.remove("fade-in"), 1000);
    result.page.highlightOnScroll();

    this.wtStep++;
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
        // reset UI
        if (this.visibleResult) {
          this.closeResult();
        }
        this.$refs.input.reset();
        this.searches = [];
        this.appEvents = [];
        this.study.activeTask = activeTaskId;
        this.hostContext = new CodeContext();
        this.selectedContext = null;
        isNewTask = true;
      } else if (this.visibleResult) {
        // A full page result is open so don't do anything
        return;
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

      // If not the task where the participant needs to search using the plain Google version
      if (treatment?.enableContext) {
        context = treatment?.contextOverride
          ? new CodeContext(treatment.contextOverride)
          : await this.$host.getContext();
        if (!this.hostContext.isEqual(context)) {
          this.hostContext = context;
          this.selectedContext = context;
        }
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

  onKeydown(e: KeyboardEvent): void {
    if (e.key === "Escape") {
      if (this.visibleResult) {
        this.closeResult();
      } else {
        // unselect text in search box
        window.getSelection().empty();
      }
      //   if (document.selection) {
      //     document.selection.empty();
      //   } else if (window.getSelection) {
      //     window.getSelection().removeAllRanges();
      //   } else if
    }
  }

  openResult(result: Result): void {
    this.visibleResult = result;
    this.search.logEvent(this.visibleResult.url, "page", "open");
  }

  closeResult(): void {
    this.visibleResult.page.dismissFragmentBlock();
    this.search.logEvent(this.visibleResult.url, "page", "close");
    this.visibleResult = null;

    this.wtStep++;
  }

  async created(): Promise<void> {
    window.addEventListener("focus", this.onAppFocus);
    window.addEventListener("resize", this.onAppResize);
    window.addEventListener("keydown", this.onKeydown);
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
