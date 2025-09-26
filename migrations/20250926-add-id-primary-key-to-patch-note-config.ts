import {Sequelize} from 'sequelize';

export const up = async ({context}: { context: Sequelize }) => {
    const queryInterface = context.getQueryInterface();
    // Check if 'id' column already exists
    const table = await queryInterface.describeTable('PatchNoteConfigs');
    if (!table.id) {
        await queryInterface.addColumn('PatchNoteConfigs', 'id', {
            type: 'INTEGER',
            autoIncrement: true,
            primaryKey: true,
            allowNull: false,
            unique: true,
        });
    }
};

export const down = async ({context}: { context: Sequelize }) => {
    const queryInterface = context.getQueryInterface();
    const table = await queryInterface.describeTable('PatchNoteConfigs');
    if (table.id) {
        await queryInterface.removeColumn('PatchNoteConfigs', 'id');
    }
};
