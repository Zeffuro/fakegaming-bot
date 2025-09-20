import {db} from './db.js';

export class BaseManager<T> {
    protected collectionKey: keyof typeof db.data;

    constructor(collectionKey: keyof typeof db.data) {
        this.collectionKey = collectionKey;
    }

    protected get collection(): T[] {
        db.data![this.collectionKey] ||= [];
        return db.data![this.collectionKey] as T[];
    }

    async add(item: T) {
        this.collection.push(item);
        await db.write();
    }

    getAll(): T[] {
        return this.collection;
    }

    async setAll(items: T[]) {
        db.data![this.collectionKey] = items as any;
        await db.write();
    }
}