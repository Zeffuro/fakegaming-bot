import {Umzug, SequelizeStorage} from 'umzug';
import {Sequelize} from 'sequelize-typescript';
import {pathToFileURL} from 'url';
import path from 'path';
import {PROJECT_ROOT} from './core/projectRoot.js';

const MIGRATIONS_ROOT = path.join(PROJECT_ROOT, 'migrations');

export async function runMigrations(sequelize: Sequelize) {
    const migrator = new Umzug({
        migrations: {
            glob: path.posix.join(MIGRATIONS_ROOT.replace(/\\/g, '/'), '*.{ts,js}'),
        },
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
