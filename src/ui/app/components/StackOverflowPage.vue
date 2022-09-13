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

class Block {
  private rect: DOMRect;

  constructor(
    public readonly identifier: string,
    public readonly element: HTMLElement
  ) {
    this.rect = element.getBoundingClientRect();
  }

  public get top(): number {
    return this.rect.top;
  }

  public get right(): number {
    return this.rect.right;
  }

  public get bottom(): number {
    return this.rect.bottom;
  }

  public get left(): number {
    return this.rect.left;
  }

  public get width(): number {
    return this.rect.width;
  }

  public get height(): number {
    return this.rect.height;
  }

  public getBox(): {
    top: number;
    right: number;
    bottom: number;
    left: number;
    width: number;
    height: number;
  } {
    this.rect = this.element.getBoundingClientRect();
    return {
      top: this.top,
      right: this.right,
      bottom: this.bottom,
      left: this.left,
      width: this.width,
      height: this.height,
    };
  }

  public toJSON(): Record<string, string | number> {
    return {
      identifier: this.identifier,
      top: this.top,
      bottom: this.bottom,
      right: this.right,
      left: this.left,
      width: this.width,
      height: this.height,
    };
  }
}

@Component({
  components: { XFrame },
})
export default class SearchResult extends Vue {
  @Prop() readonly url!: string;
  @Prop() readonly title!: string;
  @Prop() readonly focusedElement!: string;

  doc: Document = null;
  activeElement: HTMLElement;
  observer: IntersectionObserver;

  get displayTitle(): string {
    return this.doc ? this.doc.title : this.title;
  }

  public get style(): string {
    return `
    body {
      background: white !important;
      padding: 0 !important;
    }
    @-webkit-keyframes yellow-fade {
      from {
        background: #f96;
      }
      to {
        background: #fff;
      }
    }
    @-moz-keyframes yellow-fade {
      from {
        background: #f96;
      }
      to {
        background: #fff;
      }
    }
    @keyframes yellow-fade {
      from {
        background: #f96;
      }
      to {
        background: #fff;
      }
    }
    .fade-in {
      -webkit-animation: yellow-fade 1s ease-in-out 0s;
      -moz-animation: yellow-fade 1s ease-in-out 0s;
      -o-animation: yellow-fade 1s ease-in-out 0s;
      animation: yellow-fade 1s ease-in-out 0s;
    }
    .dismissed {
      opacity: 40%;
    }
    `;
  }

  onPageLoaded(url: string, document: Document): void {
    this.doc = document;

    document.querySelector("header")?.remove();
    document.querySelector("a[href='/questions/ask")?.parentElement?.remove();
    document.querySelector(".js-consent-banner")?.remove(); // cookie consent
    document.querySelector(".js-launch-popover-toggle")?.remove(); // remove sort option popover

    const style = document.createElement("style");
    document.head.appendChild(style);
    style.appendChild(document.createTextNode(this.style));

    const emitter = (action: string, data?: string | Record<string, unknown>) =>
      this.$emit(action, data);
    this.addSelectionListener(emitter);
    this.addCopyListener(emitter);
    this.addScrollListener(emitter);

    this.scrollToElement();
    this.$emit("load", url, document, this.focusedElement);
  }

  onPageError(url: string, message: string): void {
    this.$emit("error", url, message);
  }

  closePage(): void {
    this.clearHighlighOnScroll();
    this.activeElement?.classList.remove("fade-in");
    this.observer?.disconnect();
    this.$emit("close", this.url);
  }

  scrollToElement(): void {
    if (this.doc && this.focusedElement) {
      this.activeElement = this.doc.querySelector(this.focusedElement);
      this.highlightOnScroll();
      setTimeout(() => this.activeElement?.scrollIntoView(), 250);
    }
  }

  public getBlocks(): Block[] {
    const answers = Array.from(
      this.doc?.querySelectorAll<HTMLDivElement>(".answer")
    );
    const blocks = answers.map(
      (answer) =>
        new Block(
          answer.dataset.answerid || "",
          answer.querySelector(".s-prose") as HTMLElement
        )
    );
    this._blocks = blocks;
    return blocks;
  }

  public clearHighlighOnScroll(): void {
    this.activeElement?.classList.remove("fade-in");
    this.observer?.disconnect();
  }

  public highlightOnScroll(): void {
    if (this.activeElement === undefined) {
      return;
    }

    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            this.activeElement?.classList.add("fade-in");
            return;
          }
          this.activeElement?.classList.remove("fade-in");
        });
      },
      { threshold: 0.5 }
    );
    this.observer.observe(this.activeElement);
  }

  public addSelectionListener(
    listener: (action: "selectionchange", data: string) => void
  ): void {
    let selectionTimerId: number;
    const onSelectionChange = () => {
      if (selectionTimerId) {
        clearTimeout(selectionTimerId);
      }
      selectionTimerId = setTimeout(() => {
        const selection = this.doc?.getSelection();
        if (selection && !selection.isCollapsed) {
          listener("selectionchange", selection.toString());
        }
      }, 850) as unknown as number;
    };
    this.doc?.addEventListener("selectionchange", onSelectionChange);
  }

  public addCopyListener(
    listener: (action: "copy", data: string) => void
  ): void {
    const onCopy = (event: KeyboardEvent) => {
      const selection = this.doc?.getSelection();
      if (selection && !selection.isCollapsed) {
        const selectedText = selection.toString();
        if (event.key === "c" && (event.ctrlKey || event.metaKey)) {
          listener("copy", selectedText);
        }
      }
    };
    this.doc?.addEventListener("keydown", onCopy);
  }

  public addScrollListener(
    listener: (
      action: "scroll",
      data: {
        viewport: {
          x: number;
          y: number;
          height: number;
          width: number;
        };
        blocks: Block[];
      }
    ) => void
  ): void {
    const win = this.doc?.defaultView;
    let scrollTimerId: number;
    const onScroll = () => {
      if (scrollTimerId) {
        clearTimeout(scrollTimerId);
      }
      scrollTimerId = setTimeout(() => {
        const width = Math.max(
          this.doc?.documentElement.clientWidth || 0,
          win?.innerWidth || 0
        );
        const height = Math.max(
          this.doc?.documentElement.clientHeight || 0,
          win?.innerHeight || 0
        );
        const x = win?.scrollX ?? NaN;
        const y = win?.scrollY ?? NaN;
        const blocks = this.getBlocks();
        listener("scroll", { viewport: { x, y, height, width }, blocks });
      }, 500) as unknown as number;
    };

    this.doc?.addEventListener("scroll", onScroll);
  }
}
</script>
