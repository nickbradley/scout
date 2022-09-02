<template>
  <div
    class="mx-0 py-3 text-truncate"
    @mouseenter="onMouseOver"
    @mouseleave="onMouseLeave"
  >
    <code class="pa-0">
      <span
        v-html="scope"
        class="scope"
        :class="{ highlight: decorateScope }"
      ></span>
      <span v-if="scope" class="token punctuation">.</span>
      <span class="token function">{{ name }}</span>
      <span class="token punctuation">(</span>
      <template v-for="(arg, i) of args">
        <span
          :key="`${arg}-${i}-a`"
          class="arg"
          v-html="arg"
          :class="{ highlight: decorateArgs[i] }"
        ></span>
        <span
          :key="`${arg}-${i}-b`"
          v-if="i < args.length - 1"
          class="token punctuation"
          >,
        </span>
      </template>
      <span class="token punctuation">)</span>
      <span v-if="returnKind" class="token punctuation">: </span>
      <span
        v-html="returnKind"
        class="return"
        :class="{ highlight: decorateReturn }"
      ></span>
    </code>
  </div>
</template>

<script lang="ts">
import { Vue, Component, Prop } from "vue-property-decorator";
import Prism from "prismjs";
import "prismjs/themes/prism.css";
import "prismjs/components/prism-javascript";

import Signature, { Parameter, IntegrationContext } from "../Signature";

@Component()
export default class CallSignature extends Vue {
  @Prop() readonly signature!: Signature;
  @Prop() readonly integrationContext!: IntegrationContext;

  abortDecoration = null;
  decorateScope = false;
  decorateArgs = Array(10).fill(false);
  decorateReturn = false;

  get name(): string {
    return this.signature.name;
  }

  get parentType(): string {
    if (
      this.signature.parentType === undefined ||
      this.signature.parentType === "any" ||
      this.signature.parentType === "unknown"
    ) {
      return "";
    }
    return this.signature.parentType;
  }

  get arguments(): Parameter[] {
    return this.signature.parameters;
  }

  get returnType(): string {
    if (
      this.signature.returnType === undefined ||
      this.signature.returnType === "any" ||
      this.signature.returnType === "unknown"
    ) {
      return "";
    }
    return this.signature.returnType;
  }

  get scope(): string {
    return Prism.highlight(
      this.parentType,
      Prism.languages.javascript,
      "javascript"
    );
  }

  get args(): string[] {
    return this.arguments.map((arg) =>
      Prism.highlight(
        Signature.prettyPrintType(arg.type),
        Prism.languages.javascript,
        "javascript"
      )
    );
  }

  get returnKind(): string {
    return Prism.highlight(
      this.returnType,
      Prism.languages.javascript,
      "javascript"
    );
  }

  async onMouseOver(): Promise<void> {
    this.abortDecoration = false;
    const tokensToDecorate = [];

    const support = this.integrationContext;
    if (support.parentTypes.length > 0) {
      this.decorateScope = true;
      tokensToDecorate.push(
        ...support.parentTypes.map((t) => ({
          ...t,
          decorationOptions: { backgroundColor: "rgba(39, 245, 185, 0.8)" },
        }))
      );
    }
    support.parameterTypes.forEach((p, i) => {
      if (p.length > 0) {
        this.decorateArgs.splice(i, 1, true);
        tokensToDecorate.push(
          ...p.map((t) => ({
            ...t,
            decorationOptions: { backgroundColor: "rgba(39, 219, 245, 0.8)" },
          }))
        );
      }
    });
    if (support.returnTypes.length > 0) {
      this.decorateReturn = true;
      // tokensToDecorate.push(
      //   ...support.returnTypes.map((t) => ({
      //     ...t,
      //     decorationOptions: { backgroundColor: "rgba(245, 176, 39, 0.8)" },
      //   }))
      // );
    }

    await this.$host.decorate(tokensToDecorate);
    if (this.abortDecoration) {
      this.abortDecoration = null;
      this.onMouseLeave();
    }
    this.abortDecoration = null;
  }

  async onMouseLeave(): Promise<void> {
    if (this.abortDecoration === null) {
      this.decorateScope = false;
      this.decorateArgs = Array(10).fill(false);
      this.decorateReturn = false;
      await this.$host.decorate(null);
    } else {
      this.abortDecoration = true;
    }
  }

  created(): void {
    window.Prism = window.Prism || {};
    Prism.manual = true;
  }
}
</script>

<style scoped>
div {
  max-height: 20em !important;
}

div code {
  background-color: transparent !important;
}

.scope.highlight {
  background-color: rgba(39, 245, 185, 0.8);
}

.arg.highlight {
  background-color: rgba(39, 219, 245, 0.8);
}

.return.highlight {
  background-color: rgba(245, 176, 39, 0.8);
}
</style>
