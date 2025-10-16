import parser from "@typescript-eslint/parser";
import eslintPlugin from "@typescript-eslint/eslint-plugin";
import nextPlugin from "@next/eslint-plugin-next";
import globals from "globals";

export default [
    {
        ignores: ["dist/**", "**/dist/**", "node_modules/**"],
    },
    // Configuration for TypeScript files, using a more flexible parser setup
    {
        files: ["**/*.ts", "**/*.tsx"],
        languageOptions: {
            parser,
            parserOptions: {
                // More forgiving project configuration
                project: true,
                tsconfigRootDir: process.cwd(),
            },
        },
        plugins: {
            "@typescript-eslint": eslintPlugin,
        },
        rules: {
            "@typescript-eslint/no-unused-vars": [
                "error",
                {
                    argsIgnorePattern: "^_",
                    varsIgnorePattern: "^_",
                },
            ],
        },
    },
    // Separate configuration for declaration files
    {
        files: ["**/*.d.ts"],
        languageOptions: {
            parser,
            parserOptions: {
                // For declaration files, use a more relaxed configuration
                project: null,
            },
        },
        plugins: {
            "@typescript-eslint": eslintPlugin,
        },
        // Disable certain rules for declaration files
        rules: {
            "@typescript-eslint/no-explicit-any": "off",
            "@typescript-eslint/no-unused-vars": "off",
            "@typescript-eslint/ban-types": "off",
        },
    },
    {
        files: ["packages/**/*.js"],
        languageOptions: {
            globals: {
                ...globals.node,
            },
        },
    },
    {
        files: ["packages/common/src/models/**/*.js"],
        rules: {
            "no-cond-assign": "off",
        },
    },
    // Dashboard-specific rules
    {
        files: ["packages/dashboard/**/*.{js,jsx,ts,tsx}"],
        plugins: {
            "@next/next": nextPlugin,
        },
        rules: {
            ...nextPlugin.configs["core-web-vitals"].rules,
            // Flag deprecated MUI props in dashboard code to ease MUI v7 upgrades
            "no-restricted-syntax": [
                "error",
                {
                    selector: "JSXAttribute[name.name='inputProps']",
                    message:
                        "MUI v7: 'inputProps' is deprecated. Use slotProps.htmlInput for native input attributes or slotProps.input for input component props.",
                },
                {
                    selector: "JSXAttribute[name.name='InputProps']",
                    message:
                        "Migrate to slotProps.input instead of 'InputProps' where possible (TextField/Switch).",
                },
            ],
        },
    },
    // Test files: forbid direct HTTP status assertions; use shared helpers instead.
    {
        files: [
            "**/__tests__/**/*.{js,jsx,ts,tsx}",
            "**/*.test.{js,jsx,ts,tsx}",
            "**/*.spec.{js,jsx,ts,tsx}",
        ],
        rules: {
            "no-restricted-syntax": [
                "error",
                // Raw status on res.status
                {
                    selector:
                        "CallExpression[callee.property.name='toBe'][callee.object.type='CallExpression'][callee.object.callee.name='expect'][callee.object.arguments.0.type='MemberExpression'][callee.object.arguments.0.property.name='status']",
                    message:
                        "Do not assert raw status codes (expect(res.status).toBe(…)). Use shared helpers from @zeffuro/fakegaming-common/testing (e.g., expectOk/expectForbidden/expectServiceUnavailable).",
                },
                {
                    selector:
                        "CallExpression[callee.property.name='toEqual'][callee.object.type='CallExpression'][callee.object.callee.name='expect'][callee.object.arguments.0.type='MemberExpression'][callee.object.arguments.0.property.name='status']",
                    message:
                        "Do not assert raw status codes (expect(res.status).toEqual(…)). Use shared helpers from @zeffuro/fakegaming-common/testing.",
                },
                {
                    selector:
                        "CallExpression[callee.property.name='toStrictEqual'][callee.object.type='CallExpression'][callee.object.callee.name='expect'][callee.object.arguments.0.type='MemberExpression'][callee.object.arguments.0.property.name='status']",
                    message:
                        "Do not assert raw status codes (expect(res.status).toStrictEqual(…)). Use shared helpers from @zeffuro/fakegaming-common/testing.",
                },
                // Raw status on res.statusCode
                {
                    selector:
                        "CallExpression[callee.property.name='toBe'][callee.object.type='CallExpression'][callee.object.callee.name='expect'][callee.object.arguments.0.type='MemberExpression'][callee.object.arguments.0.property.name='statusCode']",
                    message:
                        "Do not assert raw status codes (expect(res.statusCode).toBe(…)). Use shared helpers from @zeffuro/fakegaming-common/testing.",
                },
                {
                    selector:
                        "CallExpression[callee.property.name='toEqual'][callee.object.type='CallExpression'][callee.object.callee.name='expect'][callee.object.arguments.0.type='MemberExpression'][callee.object.arguments.0.property.name='statusCode']",
                    message:
                        "Do not assert raw status codes (expect(res.statusCode).toEqual(…)). Use shared helpers from @zeffuro/fakegaming-common/testing.",
                },
                {
                    selector:
                        "CallExpression[callee.property.name='toStrictEqual'][callee.object.type='CallExpression'][callee.object.callee.name='expect'][callee.object.arguments.0.type='MemberExpression'][callee.object.arguments.0.property.name='statusCode']",
                    message:
                        "Do not assert raw status codes (expect(res.statusCode).toStrictEqual(…)). Use shared helpers from @zeffuro/fakegaming-common/testing.",
                },
                // Focused tests forbidden
                {
                    selector: "CallExpression[callee.type='MemberExpression'][callee.object.name='describe'][callee.property.name='only']",
                    message: "Do not commit focused tests (describe.only). Remove .only.",
                },
                {
                    selector: "CallExpression[callee.type='MemberExpression'][callee.object.name='it'][callee.property.name='only']",
                    message: "Do not commit focused tests (it.only). Remove .only.",
                },
                {
                    selector: "CallExpression[callee.type='MemberExpression'][callee.object.name='test'][callee.property.name='only']",
                    message: "Do not commit focused tests (test.only). Remove .only.",
                },
            ],
            // Enforce using the public testing entrypoint in tests
            "no-restricted-imports": [
                "error",
                {
                    patterns: [
                        { group: ["**/common/dist/testing/**"], message: "Import testing utilities from @zeffuro/fakegaming-common/testing (public entrypoint), not deep dist paths." }
                    ],
                },
            ],
        },
    },
];