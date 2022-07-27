<template>
  <v-container v-if="loading">
    <v-spacer></v-spacer>
    <v-progress-circular indeterminate color="primary"></v-progress-circular>
    <v-spacer></v-spacer>
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
        <v-expansion-panel-header class="pa-0" color="rgba(0, 0, 0, 0.05)">
          <SignatureStats
            class="flex-nowrap flex-grow-0 flex-shrink-0"
            :accepted="rec.metrics.isFromAcceptedAnswer"
            :popular="rec.metrics.isFromPopularAnswer"
            :latest="rec.metrics.isFromLatestAnswer"
          ></SignatureStats>

          <v-tooltip top open-delay="500">
            <template v-slot:activator="{ on, attrs }">
              <div v-on="on" v-bind="attrs">
                <PrettyCode
                  class="pl-2 overflow-hidden"
                  :text="rec.text"
                ></PrettyCode>
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
                    self.findIndex((eg) => ex.answerId === eg.answerId) === pos
                )
                .slice(0, 5)"
              :key="ex.answerId"
              show-arrows
              class="code-example pa-1"
            >
              <SignatureExample
                :text="ex.text"
                :source="ex.source"
                @open="$emit('open', ex.answerId)"
              ></SignatureExample>
            </v-list-item>
          </v-list>
        </v-expansion-panel-content>
      </v-expansion-panel>
    </v-expansion-panels>
  </v-card-text>
</template>

<script lang="ts">
import { Vue, Component, Prop } from "vue-property-decorator";
import SignatureExample from "@/components/SignatureExample.vue";
import PrettyCode from "@/components/PrettyCode.vue";
import SignatureStats from "@/components/SignatureStats.vue";
import { Recommendation } from "@/Page";
import WebWorker from "../WebWorker";
import { StackOverflowCallSignature } from "../../common/types";

@Component({ components: { PrettyCode, SignatureExample, SignatureStats } })
export default class SignatureProjection extends Vue {
  @Prop() readonly url!: string;
  @Prop({ default: 20000 }) readonly loadTimeout!: number;

  loading = true;
  signatures: StackOverflowCallSignature[] = [];

  panel = -1;

  /**
   * Get the three most often used call signatures (after removing duplicate calls in the same answer)
   */
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
      const key = `${sig.text}`;
      if (!Object.prototype.hasOwnProperty.call(recommendations, key)) {
        recommendations[key] = {
          text: sig.text,
          name: sig.name,
          arguments: sig.arguments,
          returnType: sig.returnType,
          parentType: sig.parentType,
          examples: [],
          metrics: {
            occurrences:
              // hack to show tutorial result in nice order for screenshot
              sig.text === "number[].reduce(function): number" ? 1000 : 0,
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
        answerURL: sig.answerUrl,
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
      .slice(0, 3);
  }

  async created(): Promise<void> {
    const pool = this.$workerPool;
    const token = {};
    let worker: WebWorker;
    let timerId: number;
    let startTime = new Date().getTime();
    try {
      timerId = setTimeout(() => token.cancel(), this.loadTimeout);
      worker = await pool.acquireWorker(token);
      clearTimeout(timerId);
      timerId = setTimeout(
        () => worker.cancel(),
        this.loadTimeout - (new Date().getTime() - startTime)
      );
      this.signatures = await worker.run({ pageURL: this.url });
      clearTimeout(timerId);
      this.$emit("load", this.recommendations);
    } catch (err) {
      this.$emit("load-error", err);
    } finally {
      this.loading = false;
      if (worker) {
        pool.releaseWorker(worker);
      }
    }
  }
}
</script>

<style scoped>
.v-progress-circular {
  display: block;
  width: 100px;
  margin: 0 auto;
}

.v-expansion-panel-content >>> .v-expansion-panel-content__wrap {
  padding: 0 !important;
  padding-right: 4px !important;
  padding-left: 4px !important;
}

.code-example:not(:last-child) {
  margin-bottom: 16px !important;
}
</style>
