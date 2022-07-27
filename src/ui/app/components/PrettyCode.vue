<template>
  <pre class="ma-0"><code class="pa-0 language-javascript">{{text}}</code></pre>
</template>

<script lang="ts">
import { Vue, Component, Prop } from "vue-property-decorator";
import Prism from "prismjs";
import "prismjs/themes/prism.css";
import "prismjs/components/prism-javascript";

@Component()
export default class PrettyCode extends Vue {
  @Prop() readonly text!: string;

  mounted(): void {
    Prism.highlightAll();
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
