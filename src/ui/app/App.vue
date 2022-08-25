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
      <div v-for="result of results" :key="result.url">
        <SearchResult
          v-bind="result"
          :projectionType="study.showSnippets ? 'signature' : 'snippet'"
          @close="(url) => onResultClose(result, url)"
          @copy="
            (data) => search.logEvent(result.url, 'projection', 'copy', data)
          "
          @copy-page="
            (data) => search.logEvent(result.url, 'page', 'copy', data)
          "
          @load-error="(err) => onResultLoadError(result, err)"
          @expand="(data) => onSearchResultExpand(result, data)"
          @load="(data) => onResultLoaded(result, data)"
          @mouseover="
            (recommendation) => onProjectionMouseOver(result, recommendation)
          "
          @mouseleave="
            (recommendation) => onProjectionMouseLeave(result, recommendation)
          "
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
import CodeContext from "@/CodeContext";
import { Recommendation } from "@/Page";
import { AppConfig, isImportToken, isFunctionToken } from "../../common/types";
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

@Component({
  components: {
    ContextList,
    SearchBar,
    SearchResult,
    Walkthrough,
  },
})
export default class App extends Vue {
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

  pagesToLoad = 0;

  resizeTimeoutId: number;

  wtShow = false;
  wtStep = 0;
  wtDisable = false;

  activeSignature = null;

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

  onResultLoaded(result: Result, data: unknown): void {
    this.pagesToLoad--;
    this.search.logEvent(result.url, "projection", "load", data);
    const resultIndex = this.results.findIndex((res) => res.url === result.url);
    if (resultIndex === 0 && this.wtStep === 0) {
      setTimeout(() => {
        this.wtStep++;
        this.wtShow = true;
      }, 250);
    }
  }

  onResultLoadError(result: Result, err: Error): void {
    this.pagesToLoad--;
    this.search.logEvent(result.url, "projection", "error", err);
    console.warn("Failed to get signatures from", this.url, ".", err);
  }

  onResultClose(result: Result, url: string): void {
    this.search.logEvent(result.url, "page", "close");
    const resultIndex = this.results.findIndex(
      (res) => res.url === result.url && res.url === url
    );
    if (resultIndex === 0 && this.wtStep === 3) {
      this.wtStep++;
    }
  }

  onSearchResultExpand(result: Result, data: string): void {
    this.search.logEvent(result.url, "projection", "expand", data);
    const resultIndex = this.results.findIndex(
      (res) =>
        res.url === result.url && data === "number[].reduce(function): number"
    );
    if (resultIndex === 0 && this.wtStep === 1) {
      this.wtStep++;
    }
  }

  onProjectionOpen(result: Result, data: unknown): void {
    this.search.logEvent(result.url, "projection", "open", data);
    const resultIndex = this.results.findIndex(
      (res) => res.url === result.url && data === "43281805"
    );
    if (resultIndex === 0 && this.wtStep === 2) {
      this.wtShow = false;
      setTimeout(() => {
        this.wtStep++;
        this.wtShow = true;
      }, 1500);
    }
  }

  async onProjectionMouseOver(
    result: Result,
    recommendation: Recommendation
  ): Promise<void> {
    const sigId = Math.floor(Math.random() * 10000);
    this.activeSignature = sigId;
    const compareType = (t1: string, t2: string): boolean => {
      // console.log("Comparing Types:", t1, t2);
      if (!t1 || !t2 || (t1 === "any" && t2 === "any")) {
        return false;
      }

      if (t1 === t2) {
        return true;
      }

      const isT1Object = t1?.startsWith("{");
      const isT2Object = t2?.startsWith("{");
      if (isT1Object && isT1Object === isT2Object) {
        return true;
      }

      const isT1Array = t1?.endsWith("[]");
      const isT2Array = t2?.endsWith("[]");
      if (isT1Array && isT1Array === isT2Array) {
        return true;
      }

      const isT1Function = t1?.includes("=>");
      const isT2Function = t2?.includes("=>");
      if (isT1Function && isT1Function === isT2Function) {
        return true;
      }

      return false;
    };
    const cxt = await this.$host.getContext();
    if (this.activeSignature !== sigId) {
      return;
    }

    const parentDecoration = { backgroundColor: "rgba(39, 245, 185, 0.8)" };
    const argumentDecoration = { backgroundColor: "rgba(39, 219, 245, 0.8)" };
    // const returnDecoration = { backgroundColor: "rgba(245, 176, 39, 0.8)" };
    const tokensToDecorate = [];

    cxt.tokens.forEach((token) => {
      if (
        isImportToken(token) &&
        token.references.includes(recommendation.parentType)
      ) {
        recommendation.decorateParent = true;
        tokensToDecorate.push({
          ...token,
          decorationOptions: parentDecoration,
        });
      } else if (isFunctionToken(token)) {
        const paramTokens = [];
        for (const param of token.parameters) {
          if (compareType(param.type.name, recommendation.parentType)) {
            recommendation.decorateParent = true;
            paramTokens.push({
              ...param,
              decorationOptions: parentDecoration,
            });
          }

          for (const arg of recommendation.arguments) {
            if (compareType(param.type.name, arg.type)) {
              arg.decorate = true;
              paramTokens.push({
                ...param,
                decorationOptions: argumentDecoration,
              });
            }
          }
        }

        const varTokens = [];
        for (const vari of token.variables) {
          if (compareType(vari.type.name, recommendation.parentType)) {
            recommendation.decorateParent = true;
            varTokens.push({
              ...vari,
              decorationOptions: parentDecoration,
            });
          }

          for (const arg of recommendation.arguments) {
            if (compareType(vari.type.name, arg.type)) {
              arg.decorate = true;
              varTokens.push({
                ...vari,
                decorationOptions: argumentDecoration,
              });
            }
          }
        }
        tokensToDecorate.push(...varTokens, ...paramTokens);
      }
    });
    await this.$host.decorate(tokensToDecorate);
    // console.log("Active Sign", this.activeSignature, sigId);
    // if (this.activeSignature !== sigId) {
    //   console.log("Calling cleanup");
    //   //await this.onProjectionMouseLeave(result, recommendation);
    //       recommendation.decorateParent = false;
    // recommendation.arguments.forEach(arg => arg.decorate = false);
    // recommendation.decorateReturn = false;
    // await this.$host.decorate('find.js', 2, null);
    // } else {
    //   this.activeSignature = null;
    // }
  }

  async onProjectionMouseLeave(
    result: Result,
    recommendation: Recommendation
  ): Promise<void> {
    // if (this.activeSignature === null) {
    // console.log("CLening")
    recommendation.decorateParent = false;
    recommendation.arguments.forEach((arg) => (arg.decorate = false));
    recommendation.decorateReturn = false;
    await this.$host.decorate(null);
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
        this.$refs.input.reset();
        this.searches = [];
        this.appEvents = [];
        this.study.activeTask = activeTaskId;
        this.hostContext = new CodeContext();
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

      // TODO Remove me (just for testing)
      const cxt = await this.$host.getContext();
      console.log("Requesting decoration", cxt);
      // await this.$host.decorate("find.js", 1, [{name: "foo", position: {start: 0, end: 10}}]);
      // setTimeout(async () => await this.$host.decorate("find.js", 2, [{name: "bar", position: {start: 30, end: 50}}]), 3000);
      // setTimeout(async () => await this.$host.decorate("find.js", 1, []), 4000)
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
