# Community submissions

Members submit links or screenshots privately through a Discord form. Reviewers approve, reject, or request changes in a private channel. Approval publishes the submission to the destination chosen for its category.

## Setup

1. Create a private text channel for reviews and a text or announcement channel for approved posts.
2. Configure their Discord permissions using the table below.
3. Open **Submissions** from the server dashboard or server settings. Add a category, select its publication and review channels, and choose its reviewer roles. Optional submitter roles restrict who may use the category; leaving these empty permits all members.
4. As an administrator, run `/submissions panel channel:<channel>` in Discord. This posts **Submit content** and **My submissions** buttons. Running it again updates the existing panel or moves it to the chosen channel.

| Audience | Private review channel | Publication channel |
| --- | --- | --- |
| Everyone and ordinary member roles | Deny View Channel | Allow viewing and Add Reactions; deny Send Messages, Create Public Threads, Create Private Threads, and Send Messages in Threads |
| Selected reviewer roles | Allow View Channel and Read Message History; optionally allow team discussion | Allow viewing; trusted reviewers may also post |
| Bot role | Allow View Channel, Read Message History, Send Messages, Embed Links, and Attach Files | Allow the same five permissions |
| Administrators | Discord's normal administrator access | Discord's normal administrator access |

Use role overwrites for reviewer access. Member-specific overwrites granting review visibility or publication write access are rejected, except those belonging to the bot. Other managed roles must also respect the channel restrictions. The bot validates the effective role permissions when saving enabled categories and again during submission and moderation; it does not change permissions automatically.

Categories can share a review channel. There may be up to 25 configured categories per server, each with 1–20 reviewer roles and optionally up to 20 submitter roles. Disable a category to stop new submissions and moderation while retaining its existing records. Disabling remains possible when a channel or role has been deleted.

## Member flow

Choose a category, add an explanation, then supply a link, screenshots, or both. Screenshots can be PNG, JPEG, or WebP: at most four images, 8 MiB per image and 20 MiB in total. Links must use HTTP or HTTPS. The credit name is optional; leaving it blank publishes anonymously, while reviewers can still see the submitting member.

The bot copies uploads into the private review message, preserving their order. It stores attachment references and refreshes the Discord URLs when preparing publication, so a pending submission does not depend on its original temporary upload URL.

**My submissions**, `/submissions mine`, and `/submissions show id:<id>` display private status and moderator feedback. Status remains available if the member has closed their DMs. There is a one-minute cooldown between submissions or revisions and a maximum of five active submissions per member per server, including failed uploads.

## Review and publication

Review cards contain the submitted content, submitting member, destination, status, and moderation buttons. Every action checks the current reviewer roles and channel permissions. Version checks prevent a second moderator from approving an old version or publishing an already handled submission.

- **Approve and publish** posts the explanation, link, screenshots, and chosen credit in the category's destination. Private feedback and the submitting member's Discord ID are excluded from the public post.
- **Reject** records a private reason.
- **Request changes** records private feedback. The member can open their status and choose **Update submission**. All screenshots must be uploaded again, including those they want to retain. The replacement needs a fresh review; previous approval controls are invalidated.

Category names and routing are saved with each submission. Configuration changes apply to new submissions and revisions; an existing review card continues to show its saved destination. Current category enablement, reviewer roles, and channel permissions still govern moderation.

Review controls persist across restarts. Interrupted uploads become editable failures. An interrupted or ambiguous public send becomes **Publication needs checking** and is not automatically resent. A reviewer can use **Find published post** to match the bot's publication marker against the latest 100 destination messages. A unique matching post saves the receipt without reposting; absence of a match leaves the state uncertain for manual investigation. A definite Discord rejection keeps approval retryable after the permissions or configuration are repaired.

The bot sends a best-effort generic DM after a moderation decision. Members use their private status for the actual feedback. Application text follows the guild's configured English or Dutch output language; dashboard language follows the independent browser preference.

Published and rejected database records are retained for up to 90 days, with a cap of 1,000 per server. Active submissions and uncertain deliveries are preserved. Discord review and publication messages follow the server's own message-retention practices.
