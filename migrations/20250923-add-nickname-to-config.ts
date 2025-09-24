import {DataTypes} from 'sequelize';
import type {Sequelize} from 'sequelize-typescript';

export const up = async ({context}: { context: Sequelize }) => {
    await context.getQueryInterface().addColumn('UserConfigs', 'nickname', {
        type: DataTypes.STRING,
        allowNull: true,
    });
};

export const down = async ({context}: { context: Sequelize }) => {
    await context.getQueryInterface().removeColumn('UserConfigs', 'nickname');
};