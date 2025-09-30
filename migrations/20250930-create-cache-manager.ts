import { DataTypes, Sequelize } from 'sequelize';

export const up = async ({ context }: { context: Sequelize }) => {
    const qi = context.getQueryInterface();
    await qi.createTable('CacheConfig', {
        key: {
            type: DataTypes.STRING,
            primaryKey: true,
            unique: true,
            allowNull: false,
        },
        value: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        expires: {
            type: DataTypes.DATE,
            allowNull: false,
        },
    });
};

export const down = async ({ context }: { context: Sequelize }) => {
    const qi = context.getQueryInterface();
    await qi.dropTable('CacheConfig');
};
