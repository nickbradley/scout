<template>
  <PrettyCode ref="pre" :text="text" class="text-truncate" />
</template>

<script lang="ts">
import { Vue, Component, Prop, Watch } from "vue-property-decorator";
import PrettyCode from "@/components/PrettyCode.vue";

@Component({
  components: { PrettyCode },
})
export default class PrettyCodeSignature extends Vue {
  @Prop() readonly text!: string;
  @Prop() readonly decorateScopeToken!: boolean;
  @Prop() readonly decorateReturnToken!: boolean;
  @Prop() readonly decorateArgTokens!: boolean[];
  // Prism.languages.insertBefore('javascript', 'keyword', {
  //   "return-type": {
  //     pattern: /: (.*)$/,
  //     lookbehind: true,
  //     // inside: Prism.languages.javascript,
  //   },
  // });
  // Prism.languages.insertBefore("javascript", "keyword", {
  //   "scope": {
  //     pattern: /(^.+)\./,
  //     // inside: Prism.languages.javascript,
  //   }
  // });

  //   get html(): string {
  //     const scopeTokenEnd = this.text.indexOf(".");
  //     const fnNameTokenEnd = this.text.indexOf("(", scopeTokenEnd);
  //     const fnArgListEnd = this.text.indexOf(")", fnNameTokenEnd);
  //     const returnTokenEnd = this.text.indexOf(":", fnNameTokenEnd);

  //     const scopeToken = this.text.substring(0, scopeTokenEnd);
  //     const fnNameToken = this.text.substring(scopeTokenEnd + 1, fnNameTokenEnd);
  //     const argTokens = this.text
  //       .substring(fnNameTokenEnd + 1, fnArgListEnd)
  //       .split(",");
  //     const returnTypeToken = this.text.substring(returnTokenEnd + 1 || this.text.length).trim();

  //     const f = `
  // <span class="scope">${scopeToken}</span>${scopeToken ? "." : ""}\
  // <span class="token.fnName">${fnNameToken}</span>(\
  // ${argTokens
  //   .map((a) => "<span class='token.argument'>" + a.trim() + "</span>")
  //   .join(", ")})${returnTypeToken ? ": " : ""}\
  // <span class="token.returnType">${returnTypeToken}</span>
  //     `;

  //     console.log("HTML", f);
  //     return f;
  //   }

  @Watch("decorateScopeToken")
  toggleScopeHighlight(): void {
    const scope = this.$refs.pre.$el.querySelector(".sig.token.scope");
    if (scope) {
      scope.classList.toggle("highlight");
    }
  }

  @Watch("decorateReturnToken")
  toggleReturnHighlight(): void {
    const rt = this.$refs.pre.$el.querySelector(".sig.token.return-type");
    if (rt) {
      rt.classList.toggle("highlight");
    }
  }

  @Watch("decorateArgTokens", { deep: true })
  toggleArgHighlights(): void {
    const args = Array.from(
      this.$refs.pre.$el.querySelectorAll(".sig.token.arg")
    );
    if (args) {
      args.forEach((arg, i) => {
        if (this.decorateArgTokens[i]) {
          arg.classList.add("highlight");
        } else {
          arg.classList.remove("highlight");
        }
      });
    }
  }

  mounted(): void {
    const pre = this.$refs.pre.$el;
    const code = pre.children[0];
    const tokens = Array.from(code.childNodes);

    const fnIndex = tokens.findIndex((t) =>
      t.className?.includes("token function")
    );
    if (fnIndex > 0) {
      const scope = document.createElement("span");
      scope.classList.add("sig", "token", "scope");
      if (this.highlightScope) {
        scope.classList.add("highlight");
      }
      scope.append(...tokens.slice(0, fnIndex - 1));
      code.insertBefore(scope, tokens[fnIndex - 1]);
    }

    const argStartIndex =
      tokens.findIndex(
        (t, i, arr) =>
          t.className?.includes("token punctuation") &&
          t.innerText === "(" &&
          arr[i - 1].className?.includes("token function")
      ) + 1;
    const argEndIndex = tokens.findLastIndex(
      (t) => t.className?.includes("token punctuation") && t.innerText === ")"
    );
    let argIndex = 0;
    let arg = document.createElement("span");
    arg.classList.add("sig", "token", "arg");
    if (this.decorateArgTokens[argIndex]) {
      arg.classList.add("highlight");
    }
    tokens.slice(argStartIndex, argEndIndex).forEach((t, i, arr) => {
      // Note: this would break if there were commas in an argument.
      // Since we abstract functions to the keyword "function," this is not a problem.
      if (t.className?.includes("token punctuation") && t.innerText === ",") {
        argIndex++;
        code.insertBefore(arg, tokens[argStartIndex + i]);
        arg = document.createElement("span");
        arg.classList.add("sig", "token", "arg");
        if (this.decorateArgTokens[argIndex]) {
          arg.classList.add("highlight");
        }
      } else {
        arg.append(t);
      }

      if (i === arr.length - 1) {
        code.insertBefore(arg, tokens[argEndIndex]);
      }
    });

    const rtIndex = tokens.findIndex(
      (t) => t.className?.includes("token operator") && t.innerText === ":"
    );
    if (rtIndex > 0) {
      const rt = document.createElement("span");
      rt.classList.add("sig", "token", "return-type");
      rt.append(...tokens.slice(rtIndex + 1));
      code.appendChild(rt);
    }
  }
}
</script>

<style scoped>
>>> .sig.token.scope.highlight {
  background-color: rgba(39, 245, 185, 0.8);
}
>>> .sig.token.arg.highlight {
  background-color: rgba(39, 219, 245, 0.8);
}
>>> .sig.token.return-type.highlight {
  background-color: rgba(245, 176, 39, 0.8);
}
</style>
