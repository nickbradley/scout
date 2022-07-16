import Vue from "vue";
import App from "./App.vue";
import vuetify from "./plugins/vuetify";
import { MockHost, VsCodeHost } from "@/Host";
import WorkerPool from "@/WorkerPool";
import { WebviewApi } from "vscode-webview";

declare global {
  interface Window {
    workerURL: string;
  }
}

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

  const scriptUrl = window.workerURL + "/signatureWorker.js";
  const response = await fetch(scriptUrl);
  if (!response.ok) {
    throw new Error(`Failed to load worker script from ${scriptUrl}`);
  }
  const blob = await response.blob();
  const scriptURL = URL.createObjectURL(blob);
  const pool = new WorkerPool(scriptURL);
  Vue.prototype.$workerPool = pool;
  console.info("Using", pool.maxWorkerCount, "workers.");

  new Vue({
    vuetify,
    render: (h) => h(App),
  }).$mount("#app");
})();
