import { DataTypes, Sequelize } from 'sequelize';

export const up = async ({ context }: { context: Sequelize }) => {
    const qi = context.getQueryInterface();

    await qi.createTable('JobRuns', {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        name: { type: DataTypes.STRING, allowNull: false },
        startedAt: { type: DataTypes.DATE, allowNull: false },
        finishedAt: { type: DataTypes.DATE, allowNull: false },
        ok: { type: DataTypes.BOOLEAN, allowNull: false },
        meta: { type: DataTypes.JSON, allowNull: true },
        error: { type: DataTypes.TEXT, allowNull: true },
        createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await qi.addIndex('JobRuns', ['name'], { name: 'ix_jobruns_name' });
    await qi.addIndex('JobRuns', ['startedAt'], { name: 'ix_jobruns_startedAt' });
    await qi.addIndex('JobRuns', ['finishedAt'], { name: 'ix_jobruns_finishedAt' });
};

export const down = async ({ context }: { context: Sequelize }) => {
    const qi = context.getQueryInterface();
    await qi.removeIndex('JobRuns', 'ix_jobruns_finishedAt');
    await qi.removeIndex('JobRuns', 'ix_jobruns_startedAt');
    await qi.removeIndex('JobRuns', 'ix_jobruns_name');
    await qi.dropTable('JobRuns');
};

