// Static list of available bot commands
export interface BotCommand {
    name: string;
    description: string;
}

export const BOT_COMMANDS: BotCommand[] = [
    { name: "help", description: "Show help information" },
    { name: "ping", description: "Check bot latency" },
    { name: "quote", description: "Get a random quote" },
    { name: "remind", description: "Set a reminder" },
];
