// eslint.config.mjs
import tseslint from "typescript-eslint";
import globals from "globals";

export default [
    {
        ignores: ["dist/**", "node_modules/**"],
    },

    // TypeScript rules
    ...tseslint.configs.recommended,
    {
        files: ["**/*.ts", "**/*.tsx"],
        languageOptions: {
            parserOptions: {
                project: "./tsconfig.json",
            },
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

    // JavaScript files: enable Node globals
    {
        files: ["packages/**/*.js"],
        languageOptions: {
            globals: {
                ...globals.node,
            },
        },
    },

    // Sequelize models: relax specific rules
    {
        files: ["packages/common/src/models/**/*.js"],
        rules: {
            "no-cond-assign": "off",
        },
    },
];
