<template>
  <div v-if="context.tokens.length === 0" class="text-caption font-italic">
    No context available.
  </div>
  <v-chip-group v-else v-model="selectedTokenIndexes" column multiple>
    <!-- eslint-disable-next-line vue/valid-v-for -->
    <v-chip v-for="tag in tags" :disabled="disabled" filter x-small>{{
      tag
    }}</v-chip>
    <v-btn v-if="isDirty" @click="apply" color="primary" x-small>Apply</v-btn>
  </v-chip-group>
</template>

<script lang="ts">
import { Vue, Component, Prop, Watch } from "vue-property-decorator";
import CodeContext from "../CodeContext";
import { ContextToken } from "@/types";

@Component
export default class ContextList extends Vue {
  @Prop() readonly context!: CodeContext;
  @Prop({ default: false }) readonly disabled!: boolean;

  selectedTokenIndexes: number[] = [];
  appliedTokenIndexes: number[] = [];

  @Watch("context")
  init(): void {
    this.selectedTokenIndexes = [...Array(this.context.tokens.length).keys()];
    this.appliedTokenIndexes = [...Array(this.context.tokens.length).keys()];
  }

  get tags(): string[] {
    return this.context.tokens.map((t) => t.value);
  }

  get selectedTokens(): ContextToken[] {
    return this.selectedTokenIndexes.map((index) => this.context.tokens[index]);
  }

  get isDirty(): boolean {
    // TODO this is reports dirty if the user re-applies the tokens in different order than they disable them
    return (
      JSON.stringify(this.selectedTokenIndexes) !==
      JSON.stringify(this.appliedTokenIndexes)
    );
  }

  apply(): void {
    this.$emit("changed", new CodeContext(this.selectedTokens));
    this.appliedTokenIndexes = this.selectedTokenIndexes;
  }

  mounted(): void {
    this.init();
  }
}
</script>

<style scoped></style>
