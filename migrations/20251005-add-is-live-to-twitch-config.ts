import { DataTypes, Sequelize } from 'sequelize';

export const up = async ({ context }: { context: Sequelize }) => {
    const qi = context.getQueryInterface();
    await qi.addColumn('TwitchStreamConfigs', 'isLive', {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
    });
};

export const down = async ({ context }: { context: Sequelize }) => {
    const qi = context.getQueryInterface();
    await qi.removeColumn('TwitchStreamConfigs', 'isLive');
};
