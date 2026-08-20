import {
    BOT_COMMANDS,
    BOT_TREE,
    type BotCommand,
    type BotModuleNode,
} from "@zeffuro/fakegaming-common/manifest";
import type { DashboardLocale } from "@/lib/i18n/localeStore";

export { BOT_COMMANDS, BOT_TREE };
export type { BotCommand, BotModuleNode };

export function getLocalizedBotCommand(
    command: BotCommand,
    locale: DashboardLocale,
): { name: string; description: string } {
    const localized = command.localizations?.[locale as keyof NonNullable<BotCommand["localizations"]>];
    return {
        name: localized?.name ?? command.name,
        description: localized?.description ?? command.description,
    };
}

