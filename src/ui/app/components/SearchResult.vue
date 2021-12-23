<template>
  <v-card
    v-if="projections.length > 0"
    :v-show="projectionsToLoad === 0"
    height="240px"
    class="ma-0 px-1 mb-2 pb-1"
    flat
    outlined
    rounded="0"
    style="display: flex !important; flex-direction: column"
  >
    <v-toolbar
      flat
      class="px-0 align-start flex-column"
      @click.prevent="$emit('open', url, 0)"
    >
      <v-avatar size="24" class="mr-2">
        <img :src="favicon" alt="favicon" />
      </v-avatar>
      <a class="pr-2 text-truncate">{{ page.title }} </a>
    </v-toolbar>
    <v-card-text class="pa-0">
      <SearchResultProjection
        v-for="(projection, i) of projections"
        :key="i"
        v-bind="projection"
        @click="(_, el) => $emit('click', el)"
        @selectionchange="$emit('select')"
        @copy="(text) => $emit('copy', text)"
        @load="onProjectionLoad"
      ></SearchResultProjection>
    </v-card-text>
  </v-card>
</template>

<script lang="ts">
import { Vue, Component, Prop } from "vue-property-decorator";
import SearchResultProjection, {
  Projection,
} from "@/components/SearchResultProjection.vue";
import Page from "@/Page";
@Component({
  components: { SearchResultProjection },
})
export default class SearchResult extends Vue {
  @Prop() readonly url!: string;
  @Prop() readonly page!: Page;
  @Prop() readonly snippet!: string;
  @Prop() readonly keywords!: string[];
  @Prop({ default: false }) readonly showSnippet!: boolean;

  projections: Projection[] = [];

  projectionsToLoad = 0;

  get favicon(): string {
    const url = new URL(this.url);
    const href =
      this.page.doc.querySelector('link[rel="icon"]')?.getAttribute("href") ||
      this.page.doc
        .querySelector('link[rel="shortcut icon"]')
        ?.getAttribute("href");
    let favicon;

    if (!href) {
      favicon = url.origin + "/favicon.ico";
    } else if (href.startsWith("http")) {
      // absolute href
      favicon = href;
    } else if (href.startsWith("/")) {
      // site-relative href
      favicon = url.origin + href;
    } else {
      // page-relative href
      favicon = url.href + "/" + href;
    }

    return favicon;
  }

  created(): void {
    let projections = [];
    if (this.snippet) {
      projections = [
        { body: this.snippet, css: "", el: null, kind: "snippet" },
      ];
    } else {
      const blocks = this.page.getBlocks();
      for (const block of blocks) {
        const fragments = this.page.sortFragments(
          this.page.getFragments(block, this.keywords)
        );
        if (fragments.length >= 1) {
          const fragment = fragments[0];
          const projection = this.page.createFragmentProjection(fragment);
          projections.push(projection);
        }
      }
    }
    this.projectionsToLoad = projections.length;
    this.projections = projections;
  }

  onProjectionLoad(): void {
    this.projectionsToLoad -= 1;
    if (this.projectionsToLoad === 0) {
      this.$emit("load");
    }
  }
}
</script>

<style scoped>
/deep/ .v-toolbar {
  /* height: 32px !important; */
}
/deep/ .v-toolbar__content {
  padding-left: 0;
  padding-right: 0;
  /* height: 32px !important; */
}
/deep/ .v-skeleton-loader__image {
  height: 180px;
}
/deep/ .v-card {
  display: flex !important;
  flex-direction: column;
}

/deep/ .v-card__text {
  flex-grow: 1;
  overflow: auto;
}
</style>
