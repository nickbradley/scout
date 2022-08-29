<template>
  <div
    class="mx-0 py-3 text-truncate"
    @mouseover="onMouseOver"
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
          >,</span
        >
      </template>
      <span class="token punctuation">)</span>
      <span v-if="returnKind" class="token punctuation">: </span>
      <span v-html="returnKind"></span>
    </code>
  </div>
</template>

<script lang="ts">
import { Vue, Component, Prop } from "vue-property-decorator";
import Prism from "prismjs";
import "prismjs/themes/prism.css";
import "prismjs/components/prism-javascript";
import { isImportToken, isFunctionToken } from "../../../common/types";

@Component()
export default class CallSignature extends Vue {
  @Prop() readonly parentType!: string;
  @Prop() readonly name!: string;
  @Prop() readonly arguments!: Array<{ name: string; type: string }>;
  @Prop() readonly returnType!: string;

  abortDecoration = null;
  decorateScope = false;
  decorateArgs = Array(10).fill(false);
  decorateReturn = false;

  get scope(): string {
    if (this.parentType === "any" || this.parentType === "unknown") {
      return "";
    }

    return Prism.highlight(
      this.parentType,
      Prism.languages.javascript,
      "javascript"
    );
  }

  get args(): string[] {
    return this.arguments.map((arg) =>
      Prism.highlight(
        this.prettyPrintType(arg.type),
        Prism.languages.javascript,
        "javascript"
      )
    );
  }

  get returnKind(): string {
    if (this.returnType === "any" || this.returnType === "unknown") {
      return "";
    }

    return Prism.highlight(
      this.returnType,
      Prism.languages.javascript,
      "javascript"
    );
  }

  prettyPrintType(type: string | undefined): string {
    if (type === undefined || type === "any") {
      return ""; // "unknown"
    } else if (type === "RegExp") {
      return "regex";
    } else if (type?.endsWith("}[]")) {
      return "object[]";
    } else if (type?.endsWith("[]") && type?.includes("=>")) {
      return "function[]";
    } else if (type?.startsWith("{")) {
      return "object";
    } else if (type?.startsWith("(")) {
      return "function";
    }
    return type;
  }

  compareTypes = (t1: string, t2: string): boolean => {
    if (!t1 || !t2 || (t1 === "any" && t2 === "any")) {
      return false;
    }

    if (t1 === t2) {
      return true;
    }

    const isT1Object = t1?.startsWith("{");
    const isT2Object = t2?.startsWith("{");
    if (isT1Object && isT1Object === isT2Object) {
      return true;
    }

    const isT1Array = t1?.endsWith("[]");
    const isT2Array = t2?.endsWith("[]");
    if (isT1Array && isT1Array === isT2Array) {
      return true;
    }

    const isT1Function = t1?.includes("=>");
    const isT2Function = t2?.includes("=>");
    if (isT1Function && isT1Function === isT2Function) {
      return true;
    }

    return false;
  };

  async onMouseOver(): Promise<void> {
    this.abortDecoration = false;
    const cxt = await this.$host.getContext();
    if (this.abortDecoration) {
      return;
    }

    const parentDecoration = { backgroundColor: "rgba(39, 245, 185, 0.8)" };
    const argumentDecoration = { backgroundColor: "rgba(39, 219, 245, 0.8)" };
    // const returnDecoration = { backgroundColor: "rgba(245, 176, 39, 0.8)" };
    const tokensToDecorate = [];

    cxt.tokens.forEach((token) => {
      if (isImportToken(token) && token.references.includes(this.parentType)) {
        this.decorateScope = true;
        tokensToDecorate.push({
          ...token,
          decorationOptions: parentDecoration,
        });
      } else if (isFunctionToken(token)) {
        const paramTokens = [];
        for (const param of token.parameters) {
          if (this.compareTypes(param.type.name, this.parentType)) {
            this.decorateScope = true;
            paramTokens.push({
              ...param,
              decorationOptions: parentDecoration,
            });
          }

          this.arguments.forEach((arg, i) => {
            if (this.compareTypes(param.type.name, arg.type)) {
              this.decorateArgs.splice(i, 1, true);
              paramTokens.push({
                ...param,
                decorationOptions: argumentDecoration,
              });
            }
          });
        }

        const varTokens = [];
        for (const vari of token.variables) {
          if (this.compareTypes(vari.type.name, this.parentType)) {
            this.decorateScope = true;
            varTokens.push({
              ...vari,
              decorationOptions: parentDecoration,
            });
          }

          this.arguments.forEach((arg, i) => {
            if (this.compareTypes(vari.type.name, arg.type)) {
              this.decorateArgs.splice(i, 1, true);
              varTokens.push({
                ...vari,
                decorationOptions: argumentDecoration,
              });
            }
          });
        }
        tokensToDecorate.push(...varTokens, ...paramTokens);
      }
    });
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
