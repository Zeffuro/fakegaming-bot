import { DataTypes, Sequelize } from 'sequelize';

export const up = async ({ context }: { context: Sequelize }) => {
    const qi = context.getQueryInterface();
    await qi.createTable('api_rate_limits', {
        key: { type: DataTypes.STRING, allowNull: false },
        window_ts: { type: DataTypes.DATE, allowNull: false },
        count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    });
    await qi.addConstraint('api_rate_limits', {
        type: 'primary key',
        fields: ['key', 'window_ts'],
        name: 'pk_api_rate_limits'
    });
    await qi.addIndex('api_rate_limits', ['window_ts'], { name: 'ix_api_rate_limits_window_ts' });
};

export const down = async ({ context }: { context: Sequelize }) => {
    const qi = context.getQueryInterface();
    await qi.dropTable('api_rate_limits');
};

