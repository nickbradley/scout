<template>
  <v-combobox
    placeholder="Search"
    prepend-inner-icon="mdi-magnify"
    append-outer-icon="mdi-reload"
    :search-input.sync="input"
    :loading="loading"
    :disabled="disabled"
    :value="value"
    @keydown.enter="search"
    @click:append-outer="reload"
  ></v-combobox>
</template>

<script lang="ts">
import { Vue, Component, Prop, Watch } from "vue-property-decorator";
import Search, { Result } from "@/Search";
import CodeContext from "@/CodeContext";
import ContextList from "@/components/ContextList.vue";
import SerpSearchProvider from "@/SerpSearchProvider";

@Component({
  components: { ContextList },
})
export default class SearchBar extends Vue {
  @Prop() readonly history!: Search[];
  @Prop() readonly context!: CodeContext;
  @Prop({ default: false }) readonly disabled!: boolean;
  @Prop({ default: false }) readonly loading!: boolean;
  @Prop({ default: null }) readonly value!: string;
  @Prop({ default: {} }) readonly cache!: Record<string, Result[]>;
  @Prop({ default: false }) readonly demo!: boolean;
  @Prop({ default: false }) readonly dedupResults!: boolean;

  input = null;
  isLoading = false;

  searchProvider = new SerpSearchProvider(this.$config.serpApiToken);

  @Watch("context")
  updateSearch(): Promise<void> {
    if (this.input) {
      this.search();
    }
  }

  @Watch("value")
  setInput(): Promise<void> {
    this.input = this.value;
    if (this.input) {
      this.search();
    }
  }

  get keywords(): string[] {
    return this.input
      .split(" ")
      .map((word) => word.trim())
      .filter((word) => word.length > 0);
  }

  public reset(): void {
    this.input = null;
  }

  public reload(): void {
    if (this.input) {
      this.$emit("reload");
      this.search();
    }
  }

  private search(): void {
    // eslint-disable-next-line no-async-promise-executor
    const searchPromise = new Promise<Search>(async (resolve, reject) => {
      try {
        const search = this.demo
          ? new Search(
              ["sum", "object", "property", "array"],
              new CodeContext([{ kind: "language", value: "javascript" }])
            )
          : new Search(this.keywords, this.context);
        console.log("SEARCH", search.keywords, search.context, search.query);
        const cachedResults = this.cache[search.query];
        if (cachedResults) {
          console.info("Using cached results for query", search.query);
          search.results = cachedResults;
        } else {
          await search.getResults(this.searchProvider, search.query);
        }
        // Remove duplicate Stack Overflow answers
        if (this.dedupResults) {
          const answerIds = {};
          search.results = search.results.filter((item) => {
            const id = item.url.match(
              /https:\/\/stackoverflow.com\/questions\/(\d+)\//
            )[0];
            return Object.prototype.hasOwnProperty.call(answerIds, id)
              ? false
              : (answerIds[id] = item);
          });
        }
        resolve(search);
      } catch (err) {
        reject(err);
      }
    });
    this.$emit("search", searchPromise);
  }
}
</script>

<style scoped></style>
