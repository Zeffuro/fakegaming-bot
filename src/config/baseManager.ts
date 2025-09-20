import {db} from './db.js';

/**
 * Base class for managing a collection in the database.
 * @template T The type of items managed by this class.
 */
export class BaseManager<T> {
    protected collectionKey: keyof typeof db.data;

    /**
     * Creates a new manager for the specified collection.
     * @param collectionKey The key of the collection in the database.
     */
    constructor(collectionKey: keyof typeof db.data) {
        this.collectionKey = collectionKey;
    }

    /**
     * Gets the collection of items from the database.
     */
    protected get collection(): T[] {
        db.data![this.collectionKey] ||= [];
        return db.data![this.collectionKey] as T[];
    }

    /**
     * Adds an item to the collection and writes to the database.
     * @param item The item to add.
     */
    async add(item: T) {
        this.collection.push(item);
        await db.write();
    }

    /**
     * Returns all items in the collection.
     */
    getAll(): T[] {
        return this.collection;
    }

    /**
     * Replaces all items in the collection and writes to the database.
     * @param items The new items to set.
     */
    async setAll(items: T[]) {
        db.data![this.collectionKey] = items as any;
        await db.write();
    }
}