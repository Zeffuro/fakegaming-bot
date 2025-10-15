import { DataTypes, Sequelize } from 'sequelize';

export const up = async ({ context }: { context: Sequelize }) => {
    const qi = context.getQueryInterface();

    await qi.createTable('Notifications', {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        provider: { type: DataTypes.STRING, allowNull: false },
        eventId: { type: DataTypes.STRING, allowNull: false },
        guildId: { type: DataTypes.STRING, allowNull: true },
        channelId: { type: DataTypes.STRING, allowNull: true },
        messageId: { type: DataTypes.STRING, allowNull: true },
        createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await qi.addConstraint('Notifications', {
        fields: ['provider', 'eventId'],
        type: 'unique',
        name: 'unique_provider_eventId'
    });

    await qi.addIndex('Notifications', ['provider'], { name: 'ix_notifications_provider' });
    await qi.addIndex('Notifications', ['createdAt'], { name: 'ix_notifications_createdAt' });
};

export const down = async ({ context }: { context: Sequelize }) => {
    const qi = context.getQueryInterface();
    await qi.removeIndex('Notifications', 'ix_notifications_createdAt');
    await qi.removeIndex('Notifications', 'ix_notifications_provider');
    await qi.removeConstraint('Notifications', 'unique_provider_eventId');
    await qi.dropTable('Notifications');
};

