import { DataTypes, Sequelize } from 'sequelize';

export const up = async ({ context }: { context: Sequelize }) => {
  const qi = context.getQueryInterface();
  await qi.addColumn('YoutubeVideoConfigs', 'guildId', {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: '',
  });
  await qi.addColumn('TwitchStreamConfigs', 'guildId', {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: '',
  });
};

export const down = async ({ context }: { context: Sequelize }) => {
  const qi = context.getQueryInterface();
  await qi.removeColumn('YoutubeVideoConfigs', 'guildId');
  await qi.removeColumn('TwitchStreamConfigs', 'guildId');
};
