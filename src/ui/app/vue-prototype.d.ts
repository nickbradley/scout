import Vue from "vue";
import { HostServiceProvider } from "@/Host";
import { AppConfig } from "@/AppConfig";

declare module "vue/types/vue" {
  interface Vue {
    $host: HostServiceProvider;
    $config: AppConfig;
  }
}
