import parser from "@typescript-eslint/parser";
import eslintPlugin from "@typescript-eslint/eslint-plugin";
import nextPlugin from "@next/eslint-plugin-next";
import globals from "globals";

export default [
    {
        ignores: ["dist/**", "node_modules/**"],
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