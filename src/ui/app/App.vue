<template>
  <v-app style="background-color: transparent">
    <v-app-bar app tile flat dark>
      <v-spacer></v-spacer>
      <SearchBar
        ref="input"
        :history="searches"
        :context="context"
        :disabled="isSearchInProgress || visibleResult !== null"
        :loading="isSearchInProgress"
        :cache="searchCache"
        :value="searchValue"
        @search="onSearch"
      ></SearchBar>
      <v-spacer></v-spacer>
      <template v-slot:extension>
        <ContextList
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
        <span v-if="search">No results.</span>
        <span v-else>Enter some terms above to make a search.</span>
      </v-container>
      <SearchResult
        v-for="result of loadedResults"
        :key="result.url"
        v-bind="result"
        :snippet="study.showSnippets ? result.snippet : ''"
        :keywords="[
          ...search.keywords,
          ...context.libraryNames,
          ...context.callNames,
        ]"
        @open="() => openResult(result)"
        @click="
          (el) => {
            search.logEvent(result.url, 'projection', 'click');
            onResultProjectionClick(result, el);
          }
        "
        @select="() => search.logEvent(result.url, 'projection', 'select')"
        @copy="
          (data) => search.logEvent(result.url, 'projection', 'copy', data)
        "
      ></SearchResult>
    </v-main>

    <v-container
      v-for="result of results"
      :key="result.url"
      style="z-index: 6; position: fixed"
      :class="{
        hidden: visibleResult === null || result.url !== visibleResult.url,
      }"
    >
      <XFrame
        sandbox="allow-scripts allow-same-origin"
        :url="result.url"
        @loaded="onPageLoaded"
        @error="onPageError"
        style="
          height: calc(100vh - 20px);
          width: 100%;
          position: absolute;
          top: 20px;
          left: 0;
          right: 0;
        "
      />
      <v-btn absolute top right rounded color="primary" @click="closeResult">
        <v-icon medium>mdi-close</v-icon>
      </v-btn>
    </v-container>
    <v-overlay :value="visibleResult !== null" opacity=".9"></v-overlay>
  </v-app>
</template>

<script lang="ts">
import { Component, Vue, Watch } from "vue-property-decorator";
import XFrame from "@/components/XFrame.vue";
import SearchResult from "@/components/SearchResult.vue";
import Search, { Result } from "@/Search";
import Page from "@/Page";
import StackoverflowPage from "@/StackoverflowPage";
import SearchBar from "@/components/SearchBar.vue";
import ContextList from "@/components/ContextList.vue";
import CodeContext from "@/CodeContext";
import { AppConfig } from "../../common/types";
import { resultsCache } from "./resultsCache";

interface AppEvent {
  timestamp: Date;
  name: string;
  data: Record<string, string | number>;
}

@Component({
  components: {
    ContextList,
    SearchBar,
    SearchResult,
    XFrame,
  },
})
export default class App extends Vue {
  study = {
    trialId: "",
    activeTask: "",
    showSnippets: false,
  };

  appEvents: AppEvent[] = [];

  config: AppConfig = {};

  // the SearchBar should emit these (they may include urls from sources like readmes)
  searches: Search[] = [];
  searchValue: string | null = null;
  searchCache: Record<string, Result[]> = {};

  hostContext: CodeContext = new CodeContext();
  selectedContext: CodeContext | null = null;

  visibleResult: Result | null = null;

  pagesToLoad = 0;

  resizeTimeoutId: number;

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
    return this.search?.results ?? [];
  }

  get loadedResults(): Result[] {
    return this.results.filter((result) => result.page);
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

  onSelectedContextChanged(selectedContext: CodeContext): void {
    // TODO Log when context is changed??
    this.selectedContext = selectedContext;
  }

  async onSearch(searchPromise: Promise<Search>): Promise<void> {
    try {
      setTimeout(() => (this.pagesToLoad = 0), 12000);
      this.pagesToLoad = 1; // trigger loading indicator
      const search = await searchPromise;
      this.pagesToLoad = search.results?.length ?? 0;
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
          page = new StackoverflowPage(
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

  onResultProjectionClick(result: Result, pageElement: HTMLElement): void {
    this.openResult(result);
    pageElement.scrollIntoView({ block: "center", inline: "center" });
    pageElement.classList.add("fade-in");
    setTimeout(() => pageElement.classList.remove("fade-in"), 1000);
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
    try {
      // For the study
      const trialConfig = await this.$host.readFile("./toast.data.json");
      const toastData = JSON.parse(trialConfig);
      this.study.trialId = toastData.id;
      const activeTaskId = toastData.activeTaskId as string;
      if (activeTaskId !== this.study.activeTask) {
        // reset UI
        if (this.visibleResult) {
          this.closeResult();
        }
        this.$refs.input.reset();
        this.searches = [];
        this.study.activeTask = activeTaskId;
        isNewTask = true;
      }
      const treatment = toastData.tasks.find(
        (task) => task.id === activeTaskId
      );
      if (treatment) {
        this.study.showSnippets = !treatment.enableFragments;
      }

      if (treatment && !treatment.enableContext) {
        const emptyContext = new CodeContext();
        this.hostContext = emptyContext;
        this.selectedContext = emptyContext;
        isContextHidden = true;
      } else {
        // Use a hard-coded context just in case they make searches when the code is not focused.
        // This also ensures that the context is comparable across all trials (even if participants do weird things in the code)
        // const context = await this.$host.getContext();
        const context = new CodeContext(treatment.contextOverride);
        if (!this.hostContext.isEqual(context)) {
          this.hostContext = context;
          this.selectedContext = context;
        }
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
    this.search.logEvent(this.visibleResult.url, "page", "close");
    this.visibleResult = null;
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
</style>
