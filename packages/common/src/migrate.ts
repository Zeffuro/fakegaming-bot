import {Umzug, SequelizeStorage} from 'umzug';
import {Sequelize} from 'sequelize-typescript';
import path from 'path';
import {pathToFileURL} from 'url';
import {PROJECT_ROOT} from './core/projectRoot.js';

const MIGRATIONS_ROOT = path.join(PROJECT_ROOT, 'migrations');

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
        logger: console,
    });

    const pending = await migrator.pending();
    console.log('Pending migrations:', pending.map(m => m.name));

    if (pending.length) {
        await migrator.up();
        console.log('Migrations completed!');
    } else {
        console.log('No pending migrations.');
    }
}