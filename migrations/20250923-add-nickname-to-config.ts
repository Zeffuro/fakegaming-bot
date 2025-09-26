import {DataTypes, Sequelize} from 'sequelize';

export const up = async ({context}: { context: Sequelize }) => {
    await context.getQueryInterface().addColumn('UserConfigs', 'nickname', {
        type: DataTypes.STRING,
        allowNull: true,
    });
};

export const down = async ({context}: { context: Sequelize }) => {
    await context.getQueryInterface().removeColumn('UserConfigs', 'nickname');
};