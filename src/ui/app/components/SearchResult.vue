<template>
  <v-card
    v-if="projections.length > 0"
    :v-show="projectionsToLoad === 0"
    height="240px"
    class="ma-0 px-2"
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
      <a class="pr-2 text-truncate">{{ title }} </a>
    </v-toolbar>
    <v-card-text>
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

  get title(): string {
    let title = this.page.title;
    if (this.url.startsWith("https://stackoverflow.com")) {
      const titleParts = title.split(" - ");
      return titleParts
        .slice(0, titleParts.length - 1)
        .filter((part) => part.includes(" "))
        .join(" - ");
    }
    return title;
  }

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
      projections = this.getProjections();
      // projections = this.page.getProjections(this.keywords);
      this.projectionsToLoad = projections.length;
    }
    this.projections = projections;
  }

  onProjectionLoad(): void {
    this.projectionsToLoad -= 1;
  }

  // private getProjections(): Projection[] {
  //   const projections = [];
  //   const blocks = this.page.getBlocks();
  //   for (const block of blocks) {
  //     const fragments = this.page.getBlockFragments(block, this.keywords).filter(frag => frag.matches.length > 0);
  //     console.log("$$$$$$$$FRAGMENTS", fragments);
  //     const sortedFragments = this.page.sortFragments(fragments);
  //     console.log("SORTED FRAGMENTS", sortedFragments);
  //     block.fragment = sortedFragments;
  //     console.log("%%%%%% MAIN BLOCK FRAGMENT", sortedFragments[0]);
  //     const projection = this.page.createProjection(sortedFragments[0]);
  //     console.log("PROJECTION", projection);
  //     projections.push(projection);
  //   }
  //   return projections;
  // }
  private getProjections(): Projection[] {
    console.log("Looking for", this.keywords);
    if (this.url.startsWith("https://stackoverflow.com")) {
      const x = Array.from(
        this.page.doc.querySelectorAll<HTMLElement>(".answer .s-prose")
      )
        .map((answer) => {
          return this.page
            .find(this.keywords, answer)
            .map(({ node, matches }) => {
              // Count of ALL tokens found within the match element (even duplicates)
              const matchCount = matches.reduce(
                (matchCount, textMatch) =>
                  matchCount + Object.values(textMatch.keywords).flat().length,
                0
              );
              return { node, matches, matchCount };
            })
            .sort((a, b) => a.matchCount - b.matchCount)
            .map(({ node, matches }) => {
              let extract;
              const textElement = node.parentElement;
              let el = textElement;
              if (textElement && textElement.tagName === "CODE") {
                const containingElement = textElement.parentElement;
                if (containingElement) {
                  el = containingElement;
                  extract = this.page.extractElement(containingElement);
                  if (containingElement.tagName === "PRE") {
                    /** Shows select lines from a code block.
                     *  Picks the first three lines that have at least one match.
                     *  If the lines are not adjacent, adds ellipses between lines.
                     */
                    extract.html = `<pre id="PRE_1"><code id="CODE_1">${matches
                      .slice(0, 3)
                      .map((match, i, matches) => {
                        let line = match.text.trimStart();
                        const nextMatch = matches[i + 1];
                        if (nextMatch && nextMatch.line > match.line + 1) {
                          line += `\n...`;
                        }
                        return line;
                      })
                      .join("\n")}</code></pre>`;
                  }
                }
              } else if (textElement && textElement.tagName === "P") {
                extract = this.page.extractElement(textElement);
              }
              if (extract) {
                return {
                  body: extract.html,
                  css: extract.style,
                  el,
                };
              } else {
                return { body: "", css: "", el };
              }
            })[0];
        })
        .filter((proj) => proj !== undefined && proj.body);
      return x;
    } else if (this.url.startsWith("https://github.com")) {
      // assume this is the readme
      const root = this.page.doc.querySelector(
        "div[data-target='readme-toc.content']"
      );
      if (root) {
        const matches = this.page.find(this.keywords, root);
        return matches.slice(0, 1).map((match) => {
          const extract = this.page.extractElement(
            match.node.parentElement as HTMLElement
          );
          return {
            body: extract.html,
            css: extract.style,
            el: match.node.parentElement as HTMLElement,
          };
        });
      }
    }
    return [];
  }

  mounted(): void {
    console.log("SEARCH RESULT MOUNTED", this.snippet);
  }
}
</script>

<style scoped>
/deep/ .v-toolbar {
  /* height: 32px !important; */
}
/deep/ .v-toolbar__content {
  /* padding-left: 0; */
  /* padding-right: 0; */
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
