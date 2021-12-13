<template>
  <v-combobox
    placeholder="Search"
    prepend-inner-icon="mdi-magnify"
    :search-input.sync="input"
    :loading="loading"
    :disabled="disabled"
    :value="value"
    @keydown.enter="search"
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

  input = null;
  isLoading = false;

  searchProvider = new SerpSearchProvider(this.$config.serpApiToken);

  @Watch("context")
  async updateSearch(): Promise<void> {
    if (this.input) {
      await this.search();
    }
  }

  @Watch("value")
  async setInput(): Promise<void> {
    this.input = this.value;
    if (this.input) {
      await this.search();
    }
  }

  get keywords(): string[] {
    return this.input
      .split(" ")
      .map((word) => word.trim())
      .filter((word) => word.length > 0);
  }

  get query(): string {
    const keywords = this.keywords;
    const lang = this.context.languageName || "";
    const libs = this.context.libraryNames;
    const calls = this.context.callNames;
    // const sites = this.context.libraries
    //   .map((lib) => lib.docSites)
    //   .flat()
    //   .filter((site) => !["github.com"].includes(site))
    //   .map((site) => `site:${site}`)
    //   .concat("site:stackoverflow.com")
    //   .join(" OR ");
    const sites = "site:stackoverflow.com";
    return [lang, ...libs, ...keywords, ...calls, sites].join(" ").trim();
  }

  public reset(): void {
    this.input = null;
  }

  private search(): void {
    // eslint-disable-next-line no-async-promise-executor
    const searchPromise = new Promise<Search>(async (resolve, reject) => {
      try {
        const search = new Search(this.keywords, this.context);
        const cachedResults = this.cache[this.query];
        if (cachedResults) {
          console.info("Using cached results for query", this.query);
          search.query = this.query;
          search.results = cachedResults;
        } else {
          await search.getResults(this.searchProvider, this.query);
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