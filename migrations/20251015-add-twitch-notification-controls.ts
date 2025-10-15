import { DataTypes, Sequelize } from 'sequelize';

export const up = async ({ context }: { context: Sequelize }) => {
    const qi = context.getQueryInterface();

    await qi.addColumn('TwitchStreamConfigs', 'cooldownMinutes', {
        type: DataTypes.INTEGER,
        allowNull: true,
    });

    await qi.addColumn('TwitchStreamConfigs', 'quietHoursStart', {
        type: DataTypes.STRING,
        allowNull: true,
    });

    await qi.addColumn('TwitchStreamConfigs', 'quietHoursEnd', {
        type: DataTypes.STRING,
        allowNull: true,
    });

    await qi.addColumn('TwitchStreamConfigs', 'lastNotifiedAt', {
        type: DataTypes.DATE,
        allowNull: true,
    });
};

export const down = async ({ context }: { context: Sequelize }) => {
    const qi = context.getQueryInterface();

    await qi.removeColumn('TwitchStreamConfigs', 'lastNotifiedAt');
    await qi.removeColumn('TwitchStreamConfigs', 'quietHoursEnd');
    await qi.removeColumn('TwitchStreamConfigs', 'quietHoursStart');
    await qi.removeColumn('TwitchStreamConfigs', 'cooldownMinutes');
};

