<template>
  <v-card>
    <v-toolbar flat>
      <v-tabs v-model="tab">
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
            :text="text"
            @selectionchange="
              (selection) => $emit('selectionchange', selection)
            "
          ></PrettyCode>
        </v-card>
      </v-tab-item>
      <v-tab-item>
        <v-card class="flex-grow-1" flat>
          <PrettyCode
            :text="source"
            @selectionchange="
              (selection) => $emit('selectionchange', selection)
            "
          ></PrettyCode>
        </v-card>
      </v-tab-item>
    </v-tabs-items>
  </v-card>
</template>

<script lang="ts">
import { Vue, Component, Prop } from "vue-property-decorator";
import PrettyCode from "@/components/PrettyCode.vue";

@Component({ components: { PrettyCode } })
export default class SignatureExample extends Vue {
  @Prop() readonly text!: string;
  @Prop() readonly source!: string;

  tab = 0;
}
</script>
