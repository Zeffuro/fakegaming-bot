import {Umzug, SequelizeStorage} from 'umzug';
import {Sequelize} from 'sequelize-typescript';
import path from 'path';
import {pathToFileURL} from 'url';
import {PROJECT_ROOT} from './core/projectRoot.js';
import {getLogger} from './utils/logger.js';

const MIGRATIONS_ROOT = path.join(PROJECT_ROOT, 'migrations');
const log = getLogger({ name: 'common:migrate' });

export async function runMigrations(sequelize: Sequelize) {
    const migrationsConfig: any = {
        glob: path.posix.join(MIGRATIONS_ROOT.replace(/\\/g, '/'), '*.{ts,js}')
    };

    // Use custom resolve only in test mode (for ts-node/jest)
    if (process.env.NODE_ENV === 'test') {
        migrationsConfig.resolve = ({name, path: migrationPath, context}: any) => {
            if (!migrationPath) throw new Error(`Migration path is undefined for migration "${name}"`);
            return {
                name,
                up: async () => {
                    const migration = await import(pathToFileURL(migrationPath).href);
                    await migration.up({context});
                },
                down: async () => {
                    const migration = await import(pathToFileURL(migrationPath).href);
                    await migration.down({context});
                },
            };
        };
    }

    const migrator = new Umzug({
        migrations: migrationsConfig,
        context: sequelize,
        storage: new SequelizeStorage({sequelize}),
        logger: {
            info: (message: unknown) => log.info({ message }, 'Migration info'),
            warn: (message: unknown) => log.warn({ message }, 'Migration warning'),
            error: (message: unknown) => log.error({ message }, 'Migration error'),
            debug: (message: unknown) => log.debug({ message }, 'Migration debug'),
        },
    });

    const pending = await migrator.pending();
    log.info({ pending: pending.map(m => m.name) }, 'Pending migrations');

    if (pending.length) {
        await migrator.up();
        log.info('Migrations completed');
    } else {
        log.info('No pending migrations');
    }
}
