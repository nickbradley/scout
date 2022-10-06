<template>
  <v-card>
    <v-toolbar flat>
      <v-tabs v-model="tab" @change="onTabChange">
        <v-tab>Usage</v-tab>
        <v-tab>Code</v-tab>
      </v-tabs>
      <v-spacer></v-spacer>
      <v-btn
        icon
        :ripple="false"
        retain-focus-on-click
        @click.stop="$emit('open')"
      >
        <v-icon>mdi-open-in-new</v-icon>
      </v-btn>
    </v-toolbar>

    <v-tabs-items v-model="tab">
      <v-tab-item>
        <v-card class="flex-grow-1" flat>
          <PrettyCode
            ref="usage"
            :text="text"
            @selectionchange="
              (selection) => $emit('selectionchange', selection)
            "
            @load="(rect) => onTabLoad('usage', rect)"
          ></PrettyCode>
        </v-card>
      </v-tab-item>
      <v-tab-item>
        <v-card class="flex-grow-1" flat>
          <PrettyCode
            ref="code"
            :text="source"
            @selectionchange="
              (selection) => $emit('selectionchange', selection)
            "
            @load="(rect) => onTabLoad('code', rect)"
          ></PrettyCode>
        </v-card>
      </v-tab-item>
    </v-tabs-items>
  </v-card>
</template>

<script lang="ts">
import { Vue, Component, Prop } from "vue-property-decorator";
import PrettyCode from "@/components/PrettyCode.vue";

import * as Util from "../Util";

@Component({ components: { PrettyCode } })
export default class SignatureExample extends Vue {
  @Prop() readonly text!: string;
  @Prop() readonly source!: string;

  tab = 0;

  get tabName(): string {
    return this.tab == 0 ? "usage" : "code";
  }

  getTabContentProperties(): Promise<any> {
    return new Promise((resolve) => {
      this.$nextTick(() => {
        // This is hacky but otherwise the code element hasn't been rendered
        setTimeout(() => {
          const content = this.tab === 0 ? this.text : this.source;
          const rect = this.$refs[this.tabName].$el.getBoundingClientRect();
          const wc = Util.getWordCount(content);
          const lc = Util.getLineCount(content);

          resolve({ rect, wc, lc });
        }, 500);
      });
    });
  }

  async onTabChange(): Promise<void> {
    const props = await this.getTabContentProperties();
    this.$emit("tabchange", {
      name: this.tabName,
      height: props.rect.height,
      width: props.rect.width,
      wc: props.wc,
      lc: props.lc,
    });
  }

  async mounted(): Promise<void> {
    const props = await this.getTabContentProperties();
    this.$emit("tabchange", {
      name: this.tabName,
      height: props.rect.height,
      width: props.rect.width,
      wc: props.wc,
      lc: props.lc,
    });
  }
}
</script>
