module.exports = {
    extends: ["plugin:@next/next/recommended"],
    parser: "@typescript-eslint/parser",
    parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: __dirname,
        ecmaVersion: 2020,
        sourceType: "module",
    },
    plugins: ["@typescript-eslint"],
};
