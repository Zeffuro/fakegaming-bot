import { AttachmentBuilder, ChatInputCommandInteraction, SlashCommandBuilder, type GuildMember } from 'discord.js';
import {DEFAULT_OUTPUT_LOCALE} from '@zeffuro/fakegaming-common';
import { buildProfileCardFilename, renderProfileCard } from '@zeffuro/fakegaming-common/profile-card';
import { createSlashCommand, getTestOnly } from '../../../core/commandBuilder.js';
import { resolveInteractionOutputLocale } from '../../../core/localization.js';
import { getGeneralCopy } from '../data/generalCopy.js';
import { profileCard as META } from '../commands.manifest.js';

const data = createSlashCommand(META, (builder: SlashCommandBuilder) => {
    builder.addUserOption(option => option
        .setName('user')
        .setDescription('User to render. Defaults to you.')
        .setRequired(false));
});

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const locale = await resolveInteractionOutputLocale(interaction);
    const copy = getGeneralCopy(locale);
    const target = interaction.options.getUser('user') ?? interaction.user;
    const member = await resolveGuildMember(interaction, target.id);
    const displayName = member?.displayName
        ?? target.globalName
        ?? target.username
        ?? formatFallbackProfileName(target.id, copy.profile.fallback);

    const profileInput = {
        userId: target.id,
        displayName,
        username: target.username,
        discriminator: target.discriminator,
        globalName: target.globalName,
        nickname: member?.nickname ?? null,
        guildName: interaction.guild?.name ?? null,
    };
    const buffer = locale === DEFAULT_OUTPUT_LOCALE
        ? renderProfileCard(profileInput)
        : renderProfileCard(profileInput, {locale});
    const attachment = new AttachmentBuilder(buffer, { name: buildProfileCardFilename(target.id) });

    await interaction.reply({
        content: copy.profile.caption(`<@${target.id}>`),
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

function formatFallbackProfileName(userId: string, fallback = 'Discord user'): string {
    const normalized = userId.trim();
    return normalized ? `${fallback} ${normalized.slice(-6)}` : fallback;
}

const testOnly = getTestOnly(META);

export default { data, execute, testOnly };
