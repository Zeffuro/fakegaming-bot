import { AttachmentBuilder, ChatInputCommandInteraction, SlashCommandBuilder, type GuildMember } from 'discord.js';
import { buildProfileCardFilename, renderProfileCard } from '@zeffuro/fakegaming-common/profile-card';
import { createSlashCommand, getTestOnly } from '../../../core/commandBuilder.js';
import { profileCard as META } from '../commands.manifest.js';

const data = createSlashCommand(META, (builder: SlashCommandBuilder) => {
    builder.addUserOption(option => option
        .setName('user')
        .setDescription('User to render. Defaults to you.')
        .setRequired(false));
});

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const target = interaction.options.getUser('user') ?? interaction.user;
    const member = await resolveGuildMember(interaction, target.id);
    const displayName = member?.displayName
        ?? target.globalName
        ?? target.username
        ?? formatFallbackProfileName(target.id);

    const buffer = renderProfileCard({
        userId: target.id,
        displayName,
        username: target.username,
        discriminator: target.discriminator,
        globalName: target.globalName,
        nickname: member?.nickname ?? null,
        guildName: interaction.guild?.name ?? null,
    });
    const attachment = new AttachmentBuilder(buffer, { name: buildProfileCardFilename(target.id) });

    await interaction.reply({
        content: `Profile card for <@${target.id}>`,
        files: [attachment],
    });
}

async function resolveGuildMember(interaction: ChatInputCommandInteraction, userId: string): Promise<GuildMember | null> {
    const cached = interaction.guild?.members.cache.get(userId);
    if (cached) return cached;

    try {
        return await interaction.guild?.members.fetch(userId) ?? null;
    } catch {
        return null;
    }
}

function formatFallbackProfileName(userId: string): string {
    const normalized = userId.trim();
    return normalized ? `Discord user ${normalized.slice(-6)}` : 'Discord user';
}

const testOnly = getTestOnly(META);

export default { data, execute, testOnly };
