import Vue from "vue";
import { HostServiceProvider } from "@/Host";
import { AppConfig } from "@/AppConfig";
import WorkerPool from "@/WorkerPool";

declare module "vue/types/vue" {
  interface Vue {
    $host: HostServiceProvider;
    $config: AppConfig;
    $workerPool: WorkerPool;
  }
}
