import { DataTypes, Sequelize } from 'sequelize';

export const up = async ({ context }: { context: Sequelize }) => {
    const qi = context.getQueryInterface();

    await qi.createTable('DisabledModuleConfigs', {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        guildId: { type: DataTypes.STRING, allowNull: false },
        moduleName: { type: DataTypes.STRING, allowNull: false },
        createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await qi.addConstraint('DisabledModuleConfigs', {
        fields: ['guildId', 'moduleName'],
        type: 'unique',
        name: 'unique_guild_module'
    });
};

export const down = async ({ context }: { context: Sequelize }) => {
    const qi = context.getQueryInterface();
    await qi.dropTable('DisabledModuleConfigs');
};

