<template>
  <v-container v-if="loading" class="text-center">
    <v-progress-circular indeterminate color="primary"></v-progress-circular>
  </v-container>
  <v-card-text v-else-if="recommendations.length === 0">
    {{ "No recommendations found." }}
  </v-card-text>
  <v-card-text v-else class="pa-0">
    <v-expansion-panels v-model="panel">
      <v-expansion-panel
        v-for="(rec, i) of recommendations"
        :key="i"
        @change="$emit('expand', rec.text)"
      >
        <div
          @mouseenter="$emit('mouseenter', rec)"
          @mouseleave="$emit('mouseleave', rec)"
          @keydown.ctrl="(event) => onCopy(event, rec)"
          @keydown.meta="(event) => onCopy(event, rec)"
        >
          <v-expansion-panel-header
            class="pa-0"
            style="user-select: text"
            color="rgba(0, 0, 0, 0.05)"
            @click.native.capture="(event) => onClickHeader(event, rec)"
          >
            <SignatureStats
              class="flex-nowrap flex-grow-0 flex-shrink-0"
              :accepted="rec.metrics.isFromAcceptedAnswer"
              :popular="rec.metrics.isFromPopularAnswer"
              :latest="rec.metrics.isFromLatestAnswer"
            ></SignatureStats>

            <v-tooltip top open-delay="500">
              <template v-slot:activator="{ on, attrs }">
                <div v-on="on" v-bind="attrs" class="text-truncate">
                  <CallSignature
                    v-bind="rec"
                    class="pl-2"
                    tabindex="0"
                  ></CallSignature>
                </div>
              </template>
              <span>{{ rec.text }}</span>
            </v-tooltip>
          </v-expansion-panel-header>

          <v-expansion-panel-content class="pa-0">
            <v-list>
              <v-list-item
                v-for="ex of rec.examples
                  .filter(
                    (ex, pos, self) =>
                      self.findIndex((eg) => ex.answerId === eg.answerId) ===
                      pos
                  )
                  .slice(0, 5)"
                :key="ex.answerId"
                show-arrows
                class="code-example pa-1"
              >
                <SignatureExample
                  :text="ex.text"
                  :source="ex.source"
                  @open="$emit('open', ex.answerUrl, `#answer-${ex.answerId}`)"
                  @selectionchange="
                    (selection) =>
                      $emit('selectionchange', rec, selection.toString())
                  "
                ></SignatureExample>
              </v-list-item>
            </v-list>
          </v-expansion-panel-content>
        </div>
      </v-expansion-panel>
    </v-expansion-panels>
  </v-card-text>
</template>

<script lang="ts">
import { Vue, Component, Prop } from "vue-property-decorator";
import CallSignature from "@/components/CallSignature.vue";
import SignatureExample from "@/components/SignatureExample.vue";
import PrettyCode from "@/components/PrettyCode.vue";
import SignatureStats from "@/components/SignatureStats.vue";
import { Recommendation } from "@/Page";

@Component({
  components: {
    CallSignature,
    PrettyCode,
    SignatureExample,
    SignatureStats,
  },
})
export default class SignatureListProjection extends Vue {
  @Prop({ default: [] }) readonly recommendations!: Recommendation[];
  @Prop({ default: false }) readonly loading!: boolean;

  panel = -1;

  onClickHeader(event: Event, recommendation: Recommendation): void {
    const selection = document.getSelection();
    if (selection && !selection.isCollapsed) {
      if (event.target.contains(selection.anchorNode)) {
        event.stopPropagation();
        this.$emit("selectionchange", recommendation, selection.toString());
      }
    }
  }

  onCopy(event: KeyboardEvent, recommendation: Recommendation): void {
    if (event.key === "c") {
      const selection = document.getSelection();
      if (selection && !selection.isCollapsed) {
        this.$emit("copy", recommendation, selection.toString());
      }
    }
  }
}
</script>

<style scoped>
.v-expansion-panel-content >>> .v-expansion-panel-content__wrap {
  padding: 0 !important;
  padding-right: 4px !important;
  padding-left: 4px !important;
}

.code-example:not(:last-child) {
  margin-bottom: 16px !important;
}
</style>
