import { Model, ModelCtor } from 'sequelize-typescript';
import {
    Attributes,
    CreationAttributes,
    DestroyOptions,
    FindAndCountOptions,
    FindOrCreateOptions,
    UpdateOptions,
    WhereOptions,
} from 'sequelize';
import { NotFoundError } from '../utils/apiErrorHelpers.js';

export class BaseManager<T extends Model> {
    protected model: ModelCtor<T>;

    constructor(model: ModelCtor<T>) {
        this.model = model;
    }

    // ---------- GET ALL ----------
    async getAll(options?: { raw?: false }): Promise<T[]>;
    async getAll(options: { raw: true }): Promise<CreationAttributes<T>[]>;
    async getAll(options?: { raw?: boolean }): Promise<T[] | CreationAttributes<T>[]> {
        return this.model.findAll({ raw: options?.raw ?? false });
    }

    // ---------- GET MANY ----------
    async getMany(
        where: WhereOptions<Attributes<T>>,
        options?: { raw?: false }
    ): Promise<T[]>;
    async getMany(
        where: WhereOptions<Attributes<T>>,
        options: { raw: true }
    ): Promise<CreationAttributes<T>[]>;
    async getMany(
        where: WhereOptions<Attributes<T>>,
        options?: { raw?: boolean }
    ): Promise<T[] | CreationAttributes<T>[]> {
        return this.model.findAll({ where, raw: options?.raw ?? false });
    }

    // ---------- GET ONE ----------
    async getOne(where: WhereOptions<Attributes<T>>, options?: { raw?: false }): Promise<T | null>;
    async getOne(where: WhereOptions<Attributes<T>>, options: { raw: true }): Promise<CreationAttributes<T> | null>;
    async getOne(where: WhereOptions<Attributes<T>>, options?: { raw?: boolean }): Promise<T | CreationAttributes<T> | null> {
        const row = await this.model.findOne({ where, raw: options?.raw ?? false });
        return row ?? null;
    }

    // ---------- ADD ----------
    async add(config: CreationAttributes<T>, options?: { raw?: false }): Promise<T>;
    async add(config: CreationAttributes<T>, options: { raw: true }): Promise<CreationAttributes<T>>;
    async add(config: CreationAttributes<T>, options?: { raw?: boolean }): Promise<T | CreationAttributes<T>> {
        const instance = await this.model.create(config);
        return options?.raw ? instance.get({ plain: true }) : instance;
    }

    // ---------- UPSERT ----------
    async upsert(item: CreationAttributes<T> | T, conflictFields?: string[]): Promise<boolean> {
        const data = item instanceof this.model ? item.get({ plain: true }) : item;

        // Build the "where" clause for uniqueness
        let conflictKeys = conflictFields?.length
            ? conflictFields
            : this.model.primaryKeyAttributes;

        if (!conflictKeys.length) {
            throw new Error('Cannot upsert: no conflictFields or primary keys specified.');
        }

        const where: Record<string, any> = {};
        for (const key of conflictKeys) {
            const value = (data as any)[key];
            if (value === undefined) {
                throw new Error(`Missing conflict field '${key}'`);
            }
            where[key] = value;
        }

        const [_, created] = await this.model.upsert(data);

        return created ?? false; // true if inserted, false if updated
    }

    async findOrCreate(config: {
        where: WhereOptions<Attributes<T>>;
        defaults?: CreationAttributes<T>;
    }): Promise<[T, boolean]> {
        return this.model.findOrCreate(
            config as FindOrCreateOptions<Attributes<T>, CreationAttributes<T>>
        );
    }

    // ---------- EXISTS ----------
    async exists(where: WhereOptions<Attributes<T>>): Promise<boolean> {
        const result = await this.model.findOne({ where });
        return !!result;
    }

    // ---------- FIND BY PK ----------
    async findByPk(id: string | number, options?: { raw?: false }): Promise<T>;
    async findByPk(id: string | number, options: { raw: true }): Promise<CreationAttributes<T>>;
    async findByPk(id: string | number, options?: { raw?: boolean }): Promise<T | CreationAttributes<T>> {
        const row = await this.model.findByPk(id, { raw: options?.raw ?? false });
        if (!row) throw new NotFoundError('Item not found');
        return options?.raw ? (row as any) : (row as T);
    }

    // ---------- UPDATE ----------
    async update(
        attributes: CreationAttributes<T>,
        where: WhereOptions<Attributes<T>>,
        options?: { raw?: false }
    ): Promise<[number, T[]]>;
    async update(
        attributes: CreationAttributes<T>,
        where: WhereOptions<Attributes<T>>,
        options: { raw: true }
    ): Promise<[number, CreationAttributes<T>[]]>;
    async update(
        attributes: CreationAttributes<T>,
        where: WhereOptions<Attributes<T>>,
        options?: { raw?: boolean }
    ): Promise<[number, (T | CreationAttributes<T>)[]]> {
        const result = await this.model.update(attributes, {
            where,
            returning: true
        } as UpdateOptions<Attributes<T>>);

        const [affectedCount, rows] = result as unknown as [number, T[] | undefined];
        const cleanRows = Array.isArray(rows)
            ? (options?.raw ? rows.map(r => r.get({ plain: true })) : rows)
            : [];

        return [affectedCount, cleanRows];
    }

    // ---------- GET AND COUNT ----------
    async getAndCountAll(
        options?: FindAndCountOptions<Attributes<T>> & { raw?: false }
    ): Promise<{ rows: T[]; count: number }>;
    async getAndCountAll(
        options: FindAndCountOptions<Attributes<T>> & { raw: true }
    ): Promise<{ rows: CreationAttributes<T>[]; count: number }>;
    async getAndCountAll(
        options?: FindAndCountOptions<Attributes<T>> & { raw?: boolean }
    ): Promise<{ rows: (T | CreationAttributes<T>)[]; count: number }> {
        const { raw, ...rest } = options || {};
        const result = await this.model.findAndCountAll({ ...rest, raw: raw ?? false });
        return { rows: result.rows, count: result.count };
    }

    // ---------- REMOVE ----------
    async remove(where: WhereOptions<Attributes<T>>): Promise<number> {
        if (!where || Object.keys(where).length === 0) {
            throw new Error('BaseManager.remove requires a non-empty where clause.');
        }
        const deleted = await this.model.destroy({ where } as DestroyOptions<Attributes<T>>);
        if (deleted === 0) throw new NotFoundError('Item not found');
        return deleted;
    }

    async removeByPk(id: string | number): Promise<void> {
        const pkField = this.model.primaryKeyAttribute;
        const deleted = await this.model.destroy({ where: { [pkField]: id } } as DestroyOptions<Attributes<T>>);
        if (deleted === 0) throw new NotFoundError(`Item with id ${id} not found`);
    }

    async removeAll(): Promise<number> {
        return this.model.destroy({ where: {} } as DestroyOptions<Attributes<T>>);
    }

    // ---------- PLAIN HELPERS ----------
    // Standardized helpers that always return plain objects (CreationAttributes)
    // to avoid confusion between model instances and plain objects

    /**
     * Get all records as plain objects
     */
    async getAllPlain(): Promise<CreationAttributes<T>[]> {
        return this.getAll({ raw: true });
    }

    /**
     * Get many records matching where clause as plain objects
     */
    async getManyPlain(where: WhereOptions<Attributes<T>>): Promise<CreationAttributes<T>[]> {
        return this.getMany(where, { raw: true });
    }

    /**
     * Get one record matching where clause as plain object
     */
    async getOnePlain(where: WhereOptions<Attributes<T>>): Promise<CreationAttributes<T> | null> {
        return this.getOne(where, { raw: true });
    }

    /**
     * Find record by primary key as plain object
     */
    async findByPkPlain(id: string | number): Promise<CreationAttributes<T>> {
        return this.findByPk(id, { raw: true });
    }

    /**
     * Add a record and return as plain object
     */
    async addPlain(attributes: CreationAttributes<T>): Promise<CreationAttributes<T>> {
        return this.add(attributes, { raw: true });
    }

    /**
     * Update records and return affected rows as plain objects
     */
    async updatePlain(
        attributes: CreationAttributes<T>,
        where: WhereOptions<Attributes<T>>
    ): Promise<[number, CreationAttributes<T>[]]> {
        return this.update(attributes, where, { raw: true });
    }
}
