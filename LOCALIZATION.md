# Localization

The application uses English (`en`) as its source locale and Dutch (`nl`) as
its first translation. Locale support is shared, while messages stay with the
package that renders them.

## Package ownership

| Package | Runtime | Catalogs |
| --- | --- | --- |
| Dashboard | `next-intl` | `packages/dashboard/messages/{locale}/**/*.json` |
| Bot | `use-intl/core` | `packages/bot/src/messages/{locale}/**/*.json` |
| API | `use-intl/core` | `packages/api/src/localization/messages/{locale}/**/*.json` |
| Common | `use-intl/core` | `packages/common/src/messages/{locale}/**/*.json` |

`packages/common/src/utils/outputLocale.ts` is the canonical locale registry.
It owns supported locale codes, the default locale, and formatting metadata. It
does not own messages from the other packages.

## Locale types

- Use `SupportedLocale` for product locale keys persisted by the application or
  passed between packages. `SupportedOutputLocale` remains the domain-specific
  alias for existing guild and user output preferences.
- Use `getOutputLocaleMetadata(locale).formatTag` only when calling `Intl` or
  another API that needs a regional BCP 47 tag.
- Use Discord's `Locale` enum only inside the bot command-localization adapter.
  Do not persist Discord locale enum values or regional formatting tags.

Catalogs use nested JSON and ICU MessageFormat. Add copy to the narrowest useful
domain file instead of creating package-wide TypeScript objects. Keep stable
IDs, protocol values, logs, and user/provider-authored content outside catalogs.
Use semantic ICU arguments such as `{channelName}` and `{count}`; numbered
placeholders such as `{value0}` are rejected because they give translators no
context.
There is intentionally no single cross-package message file: each package
loads only its own domain catalogs, while the repository validator checks their
shared locale shape.

## Locale boundaries

The product intentionally has three independent preferences:

- Guild bot output controls commands and notifications rendered for a server.
- User output controls personal or direct-message content.
- Dashboard UI language is stored in the browser and its cookie.

Do not couple these preferences. English is the fallback when a stored or
negotiated locale is absent or unsupported.

## Adding a locale

1. Add the locale and formatting metadata to the common locale registry.
2. Copy every package's `en` directory to the new locale directory and translate
   the values without changing keys or ICU arguments.
3. Add a database migration that widens existing guild/user locale constraints.
   Never rewrite an already-applied migration.
4. Add the new Discord locale mapping to the bot command catalog adapter.
5. Run `pnpm validate:i18n`, then the package tests and workspace validation.

`pnpm validate:i18n` verifies that every locale has the same files, keys, value
types, and ICU arguments as English, and parses every message. This check is part
of `pnpm fulltest`.

## Translation platforms

The English-source and per-locale JSON layout can be mapped directly by tools
such as Crowdin. No translation service is configured today. If one is added,
use each package's `en` tree as a source tree and preserve the package/domain
paths when writing translated files. Keep these repository rules in CI and
treat downloaded catalogs as untrusted input until `pnpm validate:i18n` passes.
API keys and service credentials belong in the deployment secret store, never
in catalog or configuration files.
