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
        v-for="(rec, i) of recommendations.slice(0, count)"
        :key="i"
        @change="
          if (panel !== i) {
            $emit('expand', rec.text);
          }
        "
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
                    :signature="rec.signature"
                    :integrationContext="rec.integration"
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
import { CodeToken, StackOverflowCallSignature } from "../../../common/types";
import Signature from "../../../common/Signature";

@Component({
  components: {
    CallSignature,
    PrettyCode,
    SignatureExample,
    SignatureStats,
  },
})
export default class SignatureListProjection extends Vue {
  @Prop({ default: [] }) readonly signatures!: StackOverflowCallSignature[];
  @Prop({ default: [] }) readonly codeTokens!: CodeToken[];
  @Prop({ default: false }) readonly loading!: boolean;
  @Prop({ default: 3 }) readonly count!: number;

  panel = -1;

  get recommendations(): Recommendation[] {
    const recommendations = {};
    const maxVotes = Math.max(...this.signatures.map((s) => s.voteCount));
    const latestAnswer = new Date(
      Math.max(...this.signatures.map((s) => s.lastModified))
    );

    // Compute metrics for the signatures:
    // - Count matching signatures only once for each answer (but record all instances as examples)
    // - Mark signatures from accepted, latest, and most upvoted answers
    for (const sig of this.signatures) {
      const signature = new Signature(
        sig.name,
        sig.arguments,
        sig.returnType,
        sig.parentType
      );
      const support = signature.getIntegrationContext(this.codeTokens);
      const key = `${sig.text}`;
      if (!Object.prototype.hasOwnProperty.call(recommendations, key)) {
        recommendations[key] = {
          text: sig.text,
          name: sig.name,
          arguments: sig.arguments,
          returnType: sig.returnType,
          parentType: sig.parentType,
          signature,
          integration: support,
          examples: [],
          metrics: {
            occurrences:
              // hack to show tutorial result in nice order for screenshot
              sig.text === "T[].reduce(function): T" ? 1000 : 0,
            keywordDensity: sig.answerKeywords.length / sig.answerWordCount,
            typeOverlap:
              support.parentTypes.length +
              support.parameterTypes.reduce(
                (prev, curr) => prev + curr.length,
                0
              ) +
              support.returnTypes.length,
            isFromAcceptedAnswer: false,
            isFromPopularAnswer: false,
            isFromLatestAnswer: false,
          },
        };
      }
      const rec = recommendations[key];
      if (rec.examples.findIndex((ex) => ex.answerId === sig.answerId) === -1) {
        // this is the first time seeing the call signature in the answer
        rec.metrics.occurrences++;
        rec.metrics.isFromAcceptedAnswer =
          rec.metrics.isFromAcceptedAnswer || sig.isAccepted;
        rec.metrics.isFromPopularAnswer =
          rec.metrics.isFromPopularAnswer || sig.voteCount === maxVotes;
        rec.metrics.isFromLatestAnswer =
          rec.metrics.isFromLatestAnswer ||
          sig.lastModified?.getTime() === latestAnswer.getTime();
      }
      rec.examples.push({
        answerId: sig.answerId,
        answerUrl: sig.answerUrl,
        postUrl: sig.postUrl,
        call: sig.usage,
        declaration: sig.definition,
        text: (sig.definition ? sig.definition + "\n\n" : "") + sig.usage,
        source: sig.source,
      });
    }

    return Object.values(recommendations)
      .sort((a, b) => {
        if (a.metrics.occurrences === b.metrics.occurrences) {
          if (a.metrics.isFromAcceptedAnswer) {
            return -1;
          } else if (b.metrics.isFromAcceptedAnswer) {
            return 1;
          }

          if (a.metrics.isFromPopularAnswer) {
            return -1;
          } else if (b.metrics.isFromPopularAnswer) {
            return 1;
          }

          if (a.metrics.isFromLatestAnswer) {
            return -1;
          } else if (b.metrics.isFromLatestAnswer) {
            return 1;
          }
        }

        return b.metrics.occurrences - a.metrics.occurrences;
      })
      .slice(0, 10)
      .sort((a, b) => {
        b.typeOverlap - a.typeOverlap;
      });
  }

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
