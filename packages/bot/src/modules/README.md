# Bot Modules and Command Manifests

This bot uses per-module command manifests as the single source of truth for command metadata.

- Location: `packages/bot/src/modules/<module>/commands.manifest.ts`
- Format: Export a `COMMANDS` constant with a readonly array of objects
- Values must be literal strings (no computed or template literals)

Example (`packages/bot/src/modules/general/commands.manifest.ts`):

```ts
// Static metadata for general module commands. No runtime deps.

export const help = { name: 'help', description: 'List all available commands and their descriptions.' } as const;
export const roll = { name: 'roll', description: 'Roll dice or generate a random number' } as const;

// Optional registration fields supported:
// - permissions: string (docs-only)
// - hidden: boolean (excluded from docs/manifest tree)
// - dm_permission: boolean (allow usage in DMs)
// - default_member_permissions: string (bitwise permission number as a string, e.g. '8' for Administrator)
// - testOnly: boolean (register only as a guild command; not global)

export const COMMANDS = [
    help,
    { name: 'admin-task', description: 'Admins only command', default_member_permissions: '8', dm_permission: false } as const,
    roll
] as const;

// Mark as used for type/lint systems
void COMMANDS;
```

Command manifest object shape:
- name: string (1–32 chars, lowercase letters, digits, hyphens only)
- description: string (1–100 chars recommended)
- permissions?: string (optional, for docs only)
- hidden?: boolean (optional; excluded from docs/manifest tree if true)
- dm_permission?: boolean (optional; defaults to Discord's default if omitted)
- default_member_permissions?: string (optional; bitwise permission number as a string)
- testOnly?: boolean (optional; if true, only registered to the test guild)

How to add a new command
1) Add or update `commands.manifest.ts` in your module with your command metadata.
2) Keep values literal strings (no `${...}`), so generation stays stable.
3) Regenerate the manifest and docs table:
   ```cmd
   pnpm run gen:manifest
   pnpm run gen:command-table
   ```
4) Validate and build:
   ```cmd
   pnpm run validate:commands
   pnpm run validate:commands:strict
   pnpm run validate:impl-vs-manifest
   pnpm build
   ```

Notes
- CI should run the validators to ensure unique names, valid Discord constraints, and manifest/implementation sync.
- In strict mode, CI fails if a module is missing a manifest.
- Optional module metadata can be added via `module.meta.json` next to your manifest:
  ```json
  {
      "title": "General",
      "description": "General utilities and helpers",
      "sortOrder": 10,
      "hidden": false
  }
  ```
