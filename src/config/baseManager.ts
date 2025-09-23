import {Model, ModelCtor} from 'sequelize-typescript';

/**
 * Base class for managing a Sequelize model.
 * @template T The type of Sequelize Model managed by this class.
 */
export class BaseManager<T extends Model> {
    /**
     * The Sequelize model constructor managed by this class.
     */
    protected model: ModelCtor<T>;

    /**
     * Creates a new BaseManager for the given Sequelize model.
     * @param model The Sequelize model constructor.
     */
    constructor(model: ModelCtor<T>) {
        this.model = model;
    }

    /**
     * Retrieves all records from the model.
     * @returns A promise resolving to an array of all model instances.
     */
    async getAll(): Promise<T[]> {
        return await this.model.findAll();
    }

    /**
     * Adds a new record to the model.
     * @param item The attributes for the new record.
     * @returns A promise resolving to the created model instance.
     */
    async add(item: T['_creationAttributes']): Promise<T> {
        return await this.model.create(item);
    }

    /**
     * Replaces all records in the model with the provided items.
     * @param items The array of attributes for the new records.
     * @returns A promise resolving to an array of created model instances.
     */
    async setAll(items: readonly T['_creationAttributes'][]): Promise<T[]> {
        await this.model.destroy({where: {}});
        return await this.model.bulkCreate(items);
    }
}