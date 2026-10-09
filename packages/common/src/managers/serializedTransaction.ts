import type { Sequelize, Transaction } from 'sequelize';

let pending: Promise<unknown> = Promise.resolve();

export function serializedTransaction<T>(database: Sequelize, action: (transaction: Transaction) => Promise<T>): Promise<T> {
    // SQLite shares one connection; serialize personal feature transactions within each process.
    const result = pending.catch(() => undefined).then(() => database.transaction(action));
    pending = result;
    return result;
}
