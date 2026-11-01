import { ChannelType } from 'discord.js';
import { createSlashCommand } from '../../../core/commandBuilder.js';
import { submissions as META } from '../commands.manifest.js';
import { createSubmissionHandlers } from '../shared/interactions.js';

const data = createSlashCommand(META, builder => {
    builder.setDMPermission(false)
        .addSubcommand(command => command.setName('submit').setDescription('Submit a link or screenshots for review'))
        .addSubcommand(command => command.setName('mine').setDescription('Check your private submission statuses')
            .addIntegerOption(option => option.setName('page').setDescription('Page number').setMinValue(1).setMaxValue(10001)))
        .addSubcommand(command => command.setName('show').setDescription('Open one of your submissions')
            .addStringOption(option => option.setName('id').setDescription('Submission ID').setRequired(true).setMaxLength(36)))
        .addSubcommand(command => command.setName('panel').setDescription('Post the submission panel (administrators only)')
            .addChannelOption(option => option.setName('channel').setDescription('Channel for the submission panel').setRequired(true)
                .addChannelTypes(ChannelType.GuildText)));
});

const handlers = createSubmissionHandlers();
export default { data, ...handlers };
