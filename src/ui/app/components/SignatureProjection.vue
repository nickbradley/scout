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
          <v-tooltip bottom open-delay="300">
            <template v-slot:activator="{ on, attrs }">
              <v-icon
                v-if="rec.metrics.isFromAcceptedAnswer"
                small
                v-bind="attrs"
                v-on="on"
                class="flex-grow-0"
                >mdi-check</v-icon
              >
            </template>
            <span>Accepted Answer</span>
          </v-tooltip>
          <v-tooltip bottom open-delay="300">
            <template v-slot:activator="{ on, attrs }">
              <v-icon
                v-if="rec.metrics.isFromPopularAnswer"
                small
                v-bind="attrs"
                v-on="on"
                class="flex-grow-0"
                >mdi-trending-up</v-icon
              >
            </template>
            <span>Popular Answer</span>
          </v-tooltip>
          <v-tooltip bottom open-delay="300">
            <template v-slot:activator="{ on, attrs }">
              <v-icon
                v-if="rec.metrics.isFromLatestAnswer"
                small
                v-bind="attrs"
                v-on="on"
                class="flex-grow-0"
                >mdi-update</v-icon
              >
            </template>
            <span>Recent Answer</span>
          </v-tooltip>

          <v-tooltip top open-delay="500">
            <template v-slot:activator="{ on, attrs }">
              <code
                class="language-javascript pa-3 flex-grow-1 text-truncate"
                style="background-color: transparent"
                v-bind="attrs"
                v-on="on"
                >{{ rec.text }}
              </code>
            </template>
            <span>{{ rec.text }}</span>
          </v-tooltip>
        </v-expansion-panel-header>

        <v-expansion-panel-content eager class="pa-0">
          <v-list>
            <v-list-item
              v-for="ex of rec.examples
                .filter(
                  (ex, pos, self) =>
                    self.findIndex((eg) => ex.answerId === eg.answerId) === pos
                )
                .slice(0, 5)"
              :key="ex.answerId"
              eager
              show-arrows
              class="code-example"
            >
              <v-hover v-slot="{ hover }">
                <v-card class="flex-grow-1">
                  <pre
                    class="ma-0"
                  ><code class="language-javascript">{{ex.text}}</code></pre>

                  <v-btn
                    v-show="hover"
                    absolute
                    top
                    right
                    icon
                    :ripple="false"
                    @click.stop="$emit('open', ex.answerId)"
                    style="
                      background-color: rgba(210, 210, 210, 0.8) !important;
                    "
                  >
                    <v-icon>mdi-stack-overflow</v-icon>
                  </v-btn>
                </v-card>
              </v-hover>
            </v-list-item>
          </v-list>
        </v-expansion-panel-content>
      </v-expansion-panel>
    </v-expansion-panels>
  </v-card-text>
</template>

<script lang="ts">
import { Vue, Component, Prop } from "vue-property-decorator";
import Prism from "prismjs";
import "prismjs/themes/prism.css";
import "prismjs/components/prism-javascript";
import { Recommendation } from "@/Page";
import WebWorker from "../WebWorker";
import { StackOverflowCallSignature } from "../../common/types";

@Component()
export default class SignatureProjection extends Vue {
  @Prop() readonly url!: string;
  @Prop({ default: 8000 }) readonly loadTimeout!: number;

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
          parameters: sig.parameters,
          returnType: sig.returnType,
          parentType: sig.parentType,
          examples: [],
          metrics: {
            occurrences: 0,
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
      setTimeout(() => Prism.highlightAll(), 250);
      this.$emit("load", this.recommendations);
    } catch (err) {
      console.warn("Failed to get signatures from", this.url, ".", err);
      this.$emit("error", err);
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
.hidden {
  position: fixed;
  left: -200% !important;
}

.v-btn {
  /* background-color: rgba(210, 210, 210, 0.8) !important; */
}

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

/* .v-expansion-panel-header > *:not(.v-expansion-panel-header__icon) */

pre code {
  background-color: transparent !important;
  padding-right: 4px !important;
}

.code-example:not(:last-child) {
  margin-bottom: 16px !important;
}
</style>
