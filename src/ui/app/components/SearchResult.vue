<template>
  <v-container class="pa-0">
    <v-card
      class="pa-1 pb-4"
      :elevation="0"
      @mouseup="onMouseup"
      @keydown.ctrl="onCopy"
      @keydown.meta="onCopy"
    >
      <v-card-subtitle class="pa-0 black--text text-truncate">{{
        displayLink
      }}</v-card-subtitle>
      <!-- Add :href="url" to open link in browser -->
      <v-card-title
        class="pa-0 d-block text-truncate"
        tag="a"
        @click="$emit('open-page', url)"
        >{{ title }}</v-card-title
      >
      <v-card-text v-if="extensions" class="pa-0">{{
        extensions.join(" · ")
      }}</v-card-text>
      <v-card-text v-else-if="date" class="pa-0 d-inline">{{
        date + " — "
      }}</v-card-text>
      <slot> </slot>
    </v-card>
  </v-container>
</template>

<script lang="ts">
import { Vue, Component, Prop } from "vue-property-decorator";

@Component()
export default class SearchResult extends Vue {
  @Prop() readonly url!: string;
  @Prop() readonly title!: string;
  @Prop() readonly displayLink!: string;
  @Prop() readonly date!: string;
  @Prop() readonly extensions!: string[];

  onMouseup(): void {
    const selection = document.getSelection();
    if (selection && !selection.isCollapsed) {
      this.$emit("selectionchange", selection.toString());
    }
  }

  onCopy(event: KeyboardEvent): void {
    if (event.key === "c") {
      const selection = document.getSelection();
      if (selection && !selection.isCollapsed) {
        this.$emit("copy", selection.toString());
      }
    }
  }
}
</script>

<style scoped>
.v-card {
  text-align: initial;
}
</style>
