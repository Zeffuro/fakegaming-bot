import { DataTypes, Sequelize } from 'sequelize';

export const up = async ({ context }: { context: Sequelize }) => {
    const qi = context.getQueryInterface();
    const dialect = (context as any).getDialect ? (context as any).getDialect() : 'sqlite';

    // Detect existing table to avoid duplicate creation
    const tables = (await qi.showAllTables()).map((t: unknown) => String(t).toLowerCase());
    const tableName = 'api_rate_limits';
    const hasTable = tables.includes(tableName);

    if (!hasTable) {
        await qi.createTable(tableName, {
            key: { type: DataTypes.STRING, allowNull: false },
            window_ts: { type: DataTypes.DATE, allowNull: false },
            count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        });
    }

    // Primary key/uniqueness for (key, window_ts)
    if (dialect === 'sqlite') {
        // SQLite cannot add a primary key post-hoc; use a unique index instead
        await context.query(
            'CREATE UNIQUE INDEX IF NOT EXISTS ux_api_rate_limits_key_window ON `api_rate_limits` ("key", "window_ts")'
        );
    } else {
        try {
            await qi.addConstraint(tableName, {
                type: 'primary key',
                fields: ['key', 'window_ts'],
                name: 'pk_api_rate_limits'
            });
        } catch (_err) {
            // Constraint may already exist; ignore
        }
    }

    // Hot-path index on window_ts
    if (dialect === 'sqlite') {
        await context.query(
            'CREATE INDEX IF NOT EXISTS ix_api_rate_limits_window_ts ON `api_rate_limits` ("window_ts")'
        );
    } else {
        try {
            await qi.addIndex(tableName, ['window_ts'], { name: 'ix_api_rate_limits_window_ts' });
        } catch (_err) {
            // Index may already exist; ignore
        }
    }
};

export const down = async ({ context }: { context: Sequelize }) => {
    const qi = context.getQueryInterface();
    const dialect = (context as any).getDialect ? (context as any).getDialect() : 'sqlite';

    if (dialect === 'sqlite') {
        // Best-effort cleanup
        try { await context.query('DROP INDEX IF EXISTS ix_api_rate_limits_window_ts'); } catch { /* noop */ }
        try { await context.query('DROP INDEX IF EXISTS ux_api_rate_limits_key_window'); } catch { /* noop */ }
        try { await qi.dropTable('api_rate_limits'); } catch { /* noop */ }
    } else {
        try { await qi.removeIndex('api_rate_limits', 'ix_api_rate_limits_window_ts'); } catch { /* noop */ }
        try { await qi.removeConstraint('api_rate_limits', 'pk_api_rate_limits'); } catch { /* noop */ }
        try { await qi.dropTable('api_rate_limits'); } catch { /* noop */ }
    }
};
