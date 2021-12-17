/* eslint-env node */

/** @type {import('@jest/types').Config.InitialOptions} */
const config = {
    globals: {
        "ts-jest": {
            tsconfig: "src/ui/tsconfig.json"
        }
    },
    preset: "ts-jest",
    moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/src/ui/app/$1"
    }
    // preset: "@vue/cli-plugin-unit-jest/presets/typescript-and-babel",
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