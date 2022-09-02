/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/* eslint-env node */

//@ts-check
"use strict";

//@ts-check
/** @typedef {import('webpack').Configuration} WebpackConfig **/

require("dotenv").config();

const path = require("path");
const webpack = require("webpack");

/** @type WebpackConfig */
const webExtensionConfig = {
  mode: "none", // this leaves the source code as close as possible to the original (when packaging we set this to 'production')
  target: "webworker", // extensions run in a webworker context
  entry: {
    extension: "./src/host/extension.ts",
    "test/suite/index": "./src/host/test/suite/index.ts",
  },
  output: {
    filename: "[name].js",
    path: path.join(__dirname, "./dist/host"),
    libraryTarget: "commonjs",
    devtoolModuleFilenameTemplate: "../../[resource-path]",
  },
  resolve: {
    mainFields: ["browser", "module", "main"], // look for `browser` entry point in imported node modules
    extensions: [".ts", ".js"], // support ts-files and js-files
    alias: {
      // provides alternate implementation for node module and source files
    },
    fallback: {
      // Webpack 5 no longer polyfills Node.js core modules automatically.
      // see https://webpack.js.org/configuration/resolve/#resolvefallback
      // for the list of Node.js core module polyfills.
      assert: require.resolve("assert"),
    },
  },
  module: {
    noParse: [require.resolve("typescript/lib/typescript.js")],
    rules: [
      {
        test: /\.ts$/,
        exclude: [/node_modules/, path.join(__dirname, "./src/ui")],
        use: [
          {
            loader: "ts-loader",
            options: {
              // configFile: "tsconfig.json",
              // configFile: path.join(__dirname, "src/tsconfig.json"),
              // projectReferences: true
            },
          },
        ],
      },
      {
        test: /node_modules[\\|/]code-block-writer[\\|/]umd[\\|/]/,
        use: { loader: "umd-compat-loader" },
      },
      {
        test: /\.s(c|a)ss$/,
        use: [
          "vue-style-loader",
          "css-loader",
          {
            loader: "sass-loader",
            // Requires >= sass-loader@^8.0.0
            options: {
              implementation: require("sass"),
              sassOptions: {
                indentedSyntax: true, // optional
              },
            },
          },
        ],
      },
    ],
  },
  plugins: [
    new webpack.ProvidePlugin({
      process: "process/browser", // provide a shim for the global `process` variable
    }),
    new webpack.DefinePlugin({
      "process.env": JSON.stringify(process.env),
    }),
  ],
  externals: {
    vscode: "commonjs vscode", // ignored because it doesn't exist
  },
  performance: {
    hints: false,
  },
  devtool: "nosources-source-map", // create a source map that points to the original source file
};


/** @type WebpackConfig */
// To bundle ts-morph, needed to add these settings https://github.com/dsherret/ts-morph/issues/171#issuecomment-1107867732
const webWorkerConfig = {
  mode: "none",
  target: 'webworker',
  entry: {
    page: { import: './src/common/workers/signatureWorker.ts', filename: "./common/signatureWorker.js" },
  },
  output: {
    library: {
      type: "global"
    }
  },
  // entry: './src/ui/worker/index.ts',
  // output: {
  //   filename: 'worker.js',
  //   path: path.resolve(__dirname, 'dist/ui'),
  //   libraryTarget: "commonjs",
  //   devtoolModuleFilenameTemplate: "../../[resource-path]",
  // },
  resolve: {
    extensions: [".ts", ".js"],
  },
  module: {
    noParse: [
      require.resolve("typescript/lib/typescript.js"),
      require.resolve("@ts-morph/common/dist/typescript.js")
    ],
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: "ts-loader",
            options: {
              // configFile: "tsconfig.json",
              // configFile: __dirname + "/src/ui/app/tsconfig.json",
              // projectReferences: true
            },
          },
        ],
      },
      {
        test: /node_modules[\\|/]code-block-writer[\\|/]umd[\\|/]/,
        use: { loader: "umd-compat-loader" },
      }
    ]
  },
  plugins: [
    new webpack.optimize.LimitChunkCountPlugin({
      maxChunks: 1
    }),
  ],
};

module.exports = [webExtensionConfig, webWorkerConfig];
