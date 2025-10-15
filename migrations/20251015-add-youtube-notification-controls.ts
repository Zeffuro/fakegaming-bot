import { DataTypes, Sequelize } from 'sequelize';

export const up = async ({ context }: { context: Sequelize }) => {
    const qi = context.getQueryInterface();

    await qi.addColumn('YoutubeVideoConfigs', 'cooldownMinutes', {
        type: DataTypes.INTEGER,
        allowNull: true,
    });

    await qi.addColumn('YoutubeVideoConfigs', 'quietHoursStart', {
        type: DataTypes.STRING,
        allowNull: true,
    });

    await qi.addColumn('YoutubeVideoConfigs', 'quietHoursEnd', {
        type: DataTypes.STRING,
        allowNull: true,
    });

    await qi.addColumn('YoutubeVideoConfigs', 'lastNotifiedAt', {
        type: DataTypes.DATE,
        allowNull: true,
    });
};

export const down = async ({ context }: { context: Sequelize }) => {
    const qi = context.getQueryInterface();

    await qi.removeColumn('YoutubeVideoConfigs', 'lastNotifiedAt');
    await qi.removeColumn('YoutubeVideoConfigs', 'quietHoursEnd');
    await qi.removeColumn('YoutubeVideoConfigs', 'quietHoursStart');
    await qi.removeColumn('YoutubeVideoConfigs', 'cooldownMinutes');
};

