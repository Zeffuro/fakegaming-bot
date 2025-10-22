import { DataTypes, Sequelize } from 'sequelize';

export const up = async ({ context }: { context: Sequelize }) => {
    const qi = context.getQueryInterface();

    await qi.createTable('TikTokStreamConfigs', {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        tiktokUsername: { type: DataTypes.STRING, allowNull: false },
        discordChannelId: { type: DataTypes.STRING, allowNull: false },
        customMessage: { type: DataTypes.TEXT, allowNull: true },
        cooldownMinutes: { type: DataTypes.INTEGER, allowNull: true },
        quietHoursStart: { type: DataTypes.STRING, allowNull: true },
        quietHoursEnd: { type: DataTypes.STRING, allowNull: true },
        lastNotifiedAt: { type: DataTypes.DATE, allowNull: true },
        guildId: { type: DataTypes.STRING, allowNull: false },
        isLive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
        createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await qi.addIndex('TikTokStreamConfigs', {
        name: 'unique_guild_tiktok_username',
        unique: true,
        fields: ['guildId', 'tiktokUsername']
    });
};

export const down = async ({ context }: { context: Sequelize }) => {
    const qi = context.getQueryInterface();
    await qi.removeIndex('TikTokStreamConfigs', 'unique_guild_tiktok_username');
    await qi.dropTable('TikTokStreamConfigs');
};

