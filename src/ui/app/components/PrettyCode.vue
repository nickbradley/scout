<template>
  <pre
    class="ma-0"
    @mouseup="onMouseup"
  ><code class="pa-0 language-javascript" ref="code">{{text}}</code></pre>
</template>

<script lang="ts">
import { Vue, Component, Prop } from "vue-property-decorator";
import Prism from "prismjs";
import "prismjs/themes/prism.css";
import "prismjs/components/prism-javascript";

@Component()
export default class PrettyCode extends Vue {
  @Prop() readonly text!: string;

  onMouseup(): void {
    const selection = document.getSelection();
    if (selection && !selection.isCollapsed) {
      this.$emit("selectionchange", selection);
    }
  }

  created(): void {
    window.Prism = window.Prism || {};
    Prism.manual = true;
  }

  mounted(): void {
    Prism.highlightElement(this.$refs.code);
  }
}
</script>

<style scoped>
pre {
  max-height: 20em !important;
}
pre code {
  background-color: transparent !important;
}
</style>
