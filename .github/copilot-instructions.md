# Copilot Instructions for fakegaming-bot

Follow these rules when generating code for this project:

- **TypeScript:** Use strict types. No implicit `any`. Handle `null`/`undefined` explicitly. Avoid code that won't compile with `"strict": true`.
- **Compilation Targets:** Most packages use `"target": "ESNext"` and `"module": "NodeNext"`. Use modern JS features and ES modules only. For `packages/dashboard`, use `"module": "esnext"`, `"moduleResolution": "node"`, and assume DOM/JSX features.
- **Unused Variables:** Prefix any unused arguments or variables with `_` to avoid lint errors.
- **ES Modules:** Always use `.js` extension for local imports, even when importing `.ts` files. Use `import/export`; never use CommonJS (`require`, `module.exports`), (dashboard is an exception to this since it uses next.js).
- **Exports:** Use named exports only. Do not use `export default`.
- **Command Chaining (Shell Only):** When suggesting shell/terminal commands, use `;` to chain multiple commands. **Do not use `&&`**, as it may fail with Copilot's run_in_terminal.
- **Async Code:** Use `async`/`await` for asynchronous logic. Do not use callbacks or `.then()` chaining.
- **Code Style:** 4-space indentation, TSDoc for exported functions/classes. Add comments only where they are genuinely useful; avoid excessive or redundant comments.
- **Error Handling:** Use consistent error handling. Prefer `try/catch` for async operations. Use custom error classes if present in the codebase.
- **No Dead Code:** Do not generate unused code, parameters, or imports.
- **Shared Logic:** Use `fakegaming-common` for shared models, utilities, and types. Avoid duplicating logic that belongs here.
- **Test Utilities:** Use helpers in `fakegaming-common/testing` for tests and mocks. All tests must use Vitest and helpers from `fakegaming-common/testing`. Do not use Jest, Mocha, or other test frameworks.
- **File Placement:** New Discord commands go in `packages/bot/src/modules/yourmodule/`. Shared code goes in `packages/common/`.
- **Patterns:** When creating models, migrations, commands, or similar files, look for examples in the same directory and follow their structure and boilerplate.
- **Environment Variables:** Never hardcode secrets or API keys—use environment variables loaded via the project's configuration system.
- **CI Integration:** Ensure any scripts, tests, or linting remain compatible with the CI workflows defined in the repository.
- **Key Compiler Constraints:** Do not use `const enum`. Decorators are supported (`experimentalDecorators` is true). Only use ES module syntax. Assume strict typechecking everywhere.

**Summary for AI:**
- Use strict TypeScript and ESLint.
- Target ESNext and NodeNext (except dashboard: esnext + DOM/JSX).
- Chain shell commands with `;` (not `&&`).
- Prefix unused variables/arguments with `_`.
- Use `.js` extensions for imports.
- Never use CommonJS patterns.
- Use named exports only.
- Use shared logic and test helpers from `fakegaming-common`.
- Use async/await, not callbacks.
- Take inspiration from local files for structure.
- Avoid excessive or useless comments.
- Do not generate unused code.
- Respect the TypeScript compiler options above.
- Do not hardcode secrets; use environment variables.
- Ensure CI compatibility.