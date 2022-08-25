import { CodeBlock } from "../CodeBlock";

describe("CodeBlock", () => {
    describe("getFunctionTypes", () => {
        it("Should work", () => {
            const block = new CodeBlock(`function foo(x) { const a = x*x; return a; }`);
            const fns = block.getFunctions();
            const fnTypes = block.getFunctionTypes(fns[0]);
            expect(fnTypes).toEqual({
                name: "foo",
                position: { start: 0, end: 44 },
                variables: [{ name: "a", type: "number", position: { start: 23, end: 31 } }],
                parameters: [{ name: "x", type: "any", position: { start: 13, end: 14 } }],
                returnType: "number"
            });
        });
        it("Should work with JSDoc", () => {
            const block = new CodeBlock(`
            /**
             * @param {number} x
             * @returns {string} 
             */
            function foo(x) { const a = x*x; return a; }
            `);
            const fns = block.getFunctions();
            const fnTypes = block.getFunctionTypes(fns[0]);
            expect(fnTypes).toEqual({ name: "foo", position: { start: 0, end: 156 }, variables: [{ name: "a", type: "number", position: { start: 135, end: 143 } }], parameters: [{ name: "x", type: "number", position: { start: 125, end: 126 } }], returnType: "string" });
        });
        it("Should get variable declarations defined in a higer scope", () => {
            const block = new CodeBlock(`
            const c = 23;
            function foo() {
                return c;
            }
            `);
            const fns = block.getFunctions();
            console.log(block.getFunctionTypes(fns[0]));
        })
    }); 

    describe("getExternalImports", () => {
        it("Should get external imports", () => {
            const block = new CodeBlock(`
            import foo from "foo";
            import * as bar from "bar";
            import {baz} from "baz"
            `);
            const imports = block.getExternalImports();
            expect(imports).toEqual([
                { name: "foo", module: "foo", position: { start: 19, end: 23 } },
                { name: "bar", module: "bar", position: { start: 59, end: 63 } },
                { name: "baz", module: "baz", position: { start: 96, end: 99 } },
            ]);
        });
        it("Should ignore imports using a path specifier", () => {
            const block = new CodeBlock(`
                import foo from "./foo";
                import foo from "@/foo";
                import foo from "x/foo";
            `);
            const imports = block.getExternalImports();
            expect(imports).toEqual([]);
        });
    });
    describe("getTopLevelCalls", () => {
        // it("Should find all top-level call expressions", () => {
        //     const block = new CodeBlock(`
        //         const x = foo();
        //     `);
        //     const calls = block.getTopLevelCalls();
        //     expect(calls).toEqual([]);
        // })
    })
});