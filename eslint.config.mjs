import parser from "@typescript-eslint/parser";
import eslintPlugin from "@typescript-eslint/eslint-plugin";
import nextPlugin from "@next/eslint-plugin-next";
import globals from "globals";

export default [
    {
        ignores: ["dist/**", "node_modules/**"],
    },
    {
        files: ["**/*.ts", "**/*.tsx"],
        languageOptions: {
            parser,
            parserOptions: {
                project: "./tsconfig.json",
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
    {
        files: ["packages/dashboard/**/*.{js,jsx,ts,tsx}"],
        plugins: {
            "@next/next": nextPlugin,
        },
        rules: {
            ...nextPlugin.configs["core-web-vitals"].rules,
        },
    },
];