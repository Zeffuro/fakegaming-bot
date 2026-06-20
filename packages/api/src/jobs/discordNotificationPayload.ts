import { renderTemplate } from '@zeffuro/fakegaming-common/utils';

export interface DiscordNotificationPayloadOptions {
    defaultContent: string;
    embed: Record<string, unknown>;
    buttonLabel: string;
    buttonUrl: string;
    tokens: Record<string, string>;
    customMessage?: string | null;
    urlToken?: string;
}

export interface DiscordNotificationPayload {
    content: string;
    payload: Record<string, unknown>;
}

export function buildDiscordNotificationPayload(options: DiscordNotificationPayloadOptions): DiscordNotificationPayload {
    const urlToken = options.urlToken ?? `<${options.buttonUrl}>`;
    let content = options.defaultContent;

    if (options.customMessage) {
        const template = String(options.customMessage);
        content = renderTemplate(template, options.tokens);
        if (!template.includes('{url}')) {
            content = `${content}\n${urlToken}`;
        }
    }

    return {
        content,
        payload: {
            content,
            embeds: [options.embed],
            components: [{ type: 1, components: [{ type: 2, style: 5, label: options.buttonLabel, url: options.buttonUrl }] }],
        },
    };
}
