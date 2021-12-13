import Vue from "vue";
import App from "./App.vue";
import vuetify from "./plugins/vuetify";
import { MockHost, VsCodeHost } from "@/Host";
import { WebviewApi } from "vscode-webview";

(async () => {
  Vue.config.productionTip = false;

  try {
    const vscode = acquireVsCodeApi() as WebviewApi<null>;
    Vue.prototype.$host = new VsCodeHost(vscode);
  } catch (err) {
    console.warn(
      "Scout is running outside of a VSCode extension. Not all features are available.",
      err
    );
    Vue.prototype.$host = new MockHost();
  }

  const timer = setTimeout(
    () => console.error("Failed to get config from host. Cannot continue."),
    1500
  );
  Vue.prototype.$config = await Vue.prototype.$host.getConfig();
  clearTimeout(timer);

  new Vue({
    vuetify,
    render: (h) => h(App),
  }).$mount("#app");
})();
