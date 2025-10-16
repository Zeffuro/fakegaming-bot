# Testing helpers

This package exposes shared test utilities for the monorepo via `@zeffuro/fakegaming-common/testing`.

Key areas:

- Builders/mocks for Discord: `createMockCommandInteraction`, `createMockUser`, `createMockGuild`, etc.
- One-shot setup for command/service tests: `setupCommandTest`, `setupServiceTest`, `setupTest`.
- Reply/editReply assertions for Discord interactions.
- API testing helpers and mocks.

API route testing (DX)

- `setupApiRouteTest(options?)` creates a full API test context. By default it auto-seeds admin access for a default test user so guild-scoped routes don’t 403.
  - Defaults: `userId: 'testuser'`, `guildId: 'test-guild'`, `permissions: 0x8 (Administrator)`, `owner: false`.
  - Customize with `seed: { userId?, guildId?, permissions?: string | number, owner?, ttlMs? }`.
  - Disable with `autoSeedTestUserGuild: false`.

Discord interaction helpers

- expectEphemeralReply(interaction, { contains?, equals? })
  Asserts that `interaction.reply(...)` was called with an ephemeral message. You can assert the full content or that it contains a substring.

- expectReplyText(interaction, expected)
  Asserts that `reply` content equals the expected string (works for `string` or `{ content }`).

- expectReplyTextContains(interaction, substring)
  Asserts that `reply` content contains the substring.

- expectEditReplyContainsText(interaction, substring)
  Asserts that the first `editReply` call contains the substring. Works with:
  - string payloads
  - `{ content: string }`
  - `{ embeds: [{ description: string }] }` or raw embed data `{ data: { description: string } }`

- expectEditReplyWithAttachment(interaction, { filenameIncludes?, filenameEquals?, contentContains? })
  Asserts that the first `editReply` call contains at least one file and optionally validates the file name or content text.

Embed assertions

- expectReplyHasEmbed(interaction, opts?)
  Asserts that a `reply` payload includes at least one embed. Optional `opts` to match `title`, `description`, or a specific `field`.

- expectEditReplyHasEmbed(interaction, opts?)
  Asserts that an `editReply` payload includes at least one embed. Same optional `opts`.

- expectSendHasEmbed(targetWithSend, opts?)
  Asserts that a `channel.send()`/`user.send()` payload includes an embed. Same optional `opts`.

- expectReplyHasEmbedsArray(interaction, { min? })
  Asserts that a `reply` payload has an `embeds` array with at least `min` elements (default 1).

Options shape for embed matchers

```ts
interface EmbedExpectOptions {
    titleEquals?: string;
    titleContains?: string;
    descriptionEquals?: string;
    descriptionContains?: string;
    field?: {
        nameEquals?: string;
        nameContains?: string;
        valueEquals?: string;
        valueContains?: string;
    };
}
```

- Works with `EmbedBuilder` instances (via `embed.data`) and plain objects (`{ title, description, fields }`).

Discord interaction builder

- createMockCommandInteraction(options)
  Quickly build a command interaction with options:
  - `stringOptions`: map of option name to string
  - `userOptions`: map of option name to a user ID string
  - `channelOptions`, `integerOptions`, `booleanOptions`, `subcommand`
  - `user`, `guildId`, `channelId`, etc.

Example

```ts
import { createMockCommandInteraction, expectEditReplyHasEmbed } from '@zeffuro/fakegaming-common/testing';

const interaction = createMockCommandInteraction({
    user: { id: '123' },
    stringOptions: { query: 'hello world' }
});

await command.execute(interaction as any);

expectEditReplyHasEmbed(interaction, {
    titleContains: 'Results',
    descriptionContains: 'hello world',
});
```

Notes

- All helpers are strict-typed and designed for Vitest.
- Prefer these shared helpers over custom, duplicated mocks in package tests.
- If you need an additional assertion that may benefit multiple suites, add it here and re-export it via the testing index.
