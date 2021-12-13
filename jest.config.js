/* eslint-env node */

/** @type {import('@jest/types').Config.InitialOptions} */
const config = {
    preset: "@vue/cli-plugin-unit-jest/presets/typescript-and-babel",
    // testRegex: "(/tests/.*|(\\.|/)(test|spec))\\.(jsx?|tsx?)$",
    // moduleFileExtensions: [
    //     "js",
    //     "ts",
    //     "vue"
    // ],
    // transform: {
    //     ".*\\.(vue)$": "vue-jest",
    //     "^.+\\.tsx?$": "ts-jest"
    // },
    // "testURL": "http://localhost/"
};

module.exports = config;