/* eslint-env node */

const dotenv = require("dotenv").config();

const path = require("path");
/**
 * @type {import('@vue/cli-service').ProjectOptions}
 */
module.exports = {
  filenameHashing: false,
  outputDir: "./dist/ui",
  transpileDependencies: ["vuetify"],
  chainWebpack: (config) => {
    config.optimization.minimize(false);
    config.module
      .rule("js")
      .use("babel-loader")
      .tap(() => ({ rootMode: "upward" }));
    // config.module
    //   .rule('ts')
    //   .use('ts-loader')
    //   .merge({
    //     options: {
    //       configFile: path.join(__dirname, "src/tsconfig.json"),
    //     },
    //   });
    // config
    //   .plugin('fork-ts-checker')
    //   .tap(args => {
    //     console.log("ARGS", args);
    //     args[0].typescript.configFile = path.join(__dirname, "src/tsconfig.json");
    //     return args;
    //   });
    config.plugin("define").tap((definitions) => {
      const env = dotenv.parsed;
      // TODO This masks the process.env that must be set elsewhere.
      definitions[0]["process.env"] = JSON.stringify({
        NODE_ENV: process.env.NODE_ENV,
        BASE_URL: process.env.BASE_URL, // TODO This isn't set at this point
        ...env,
      });
      return definitions;
    });
  },
  configureWebpack: {
    resolve: {
      alias: {
        "@": path.join(__dirname, "/src/ui/app"),
      },
    },
    entry: {
      app: path.join(__dirname, "src", "ui", "app", "main.ts"),
    },
  },
};
