import { DataTypes, Sequelize } from 'sequelize';

export const up = async ({ context }: { context: Sequelize }) => {
  const qi = context.getQueryInterface();
  await qi.addColumn('PatchSubscriptionConfigs', 'guildId', {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: '',
  });
};

export const down = async ({ context }: { context: Sequelize }) => {
  const qi = context.getQueryInterface();
  await qi.removeColumn('PatchSubscriptionConfigs', 'guildId');
};

