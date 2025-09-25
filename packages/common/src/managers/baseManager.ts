import {Model, ModelCtor} from 'sequelize-typescript';
import {
    CreationAttributes,
    DestroyOptions,
    FindAndCountOptions,
    FindOrCreateOptions,
    UpdateOptions,
    WhereOptions,
    Attributes,
} from 'sequelize';

export class BaseManager<T extends Model> {
    protected model: ModelCtor<T>;

    constructor(model: ModelCtor<T>) {
        this.model = model;
    }

    async getAll(): Promise<T[]> {
        return await this.model.findAll();
    }

    async getAllPlain(): Promise<T[]> {
        const rows = await this.model.findAll({raw: true});
        return rows.map(r => ({...r}));
    }

    async set(item: CreationAttributes<T>, primaryKeyName: keyof CreationAttributes<T>): Promise<[T, boolean]> {
        const [record, created] = await this.model.findOrCreate({
            where: {
                [primaryKeyName]: item[primaryKeyName]
            } as WhereOptions<CreationAttributes<T>>,
            defaults: item,
        } as FindOrCreateOptions<Attributes<T>, CreationAttributes<T>>);

        if (!created) {
            await record.update(item);
        }

        return [record, created];
    }

    async getOne(where: WhereOptions<Attributes<T>>): Promise<T | null> {
        return await this.model.findOne({where});
    }

    async getOnePlain(where: WhereOptions<Attributes<T>>): Promise<object | null> {
        const row = await this.model.findOne({where, raw: true});
        return row ? {...row} : null;
    }

    async getMany(where: WhereOptions<Attributes<T>>): Promise<T[]> {
        return await this.model.findAll({where});
    }

    async getManyPlain(where: WhereOptions<Attributes<T>>): Promise<object[]> {
        const rows = await this.model.findAll({where, raw: true});
        return rows.map(r => ({...r}));
    }

    async add(config: CreationAttributes<T>): Promise<T> {
        return await this.model.create(config);
    }

    async addPlain(config: CreationAttributes<T>): Promise<T> {
        const instance = await this.model.create(config);
        return instance.get({plain: true}); // consistent plain object
    }

    async upsert(item: CreationAttributes<T>): Promise<boolean> {
        const [, created] = await this.model.upsert(item);
        return created || false;
    }

    async findOrCreate(config: {
        where: WhereOptions<Attributes<T>>,
        defaults?: CreationAttributes<T>
    }): Promise<[T, boolean]> {
        const [record, created] = await this.model.findOrCreate(config as FindOrCreateOptions<Attributes<T>, CreationAttributes<T>>);
        return [record, created];
    }

    async exists(where: WhereOptions<Attributes<T>>): Promise<boolean> {
        const result = await this.model.findOne({where, attributes: ['id']});
        return !!result;
    }

    async getAndCountAll(options?: FindAndCountOptions<Attributes<T>>): Promise<{ rows: T[], count: number }> {
        const result = await this.model.findAndCountAll({...options, raw: true});
        return {rows: result.rows.map(r => ({...r})), count: result.count};
    }

    async findByPk(id: string | number): Promise<T | null> {
        return await this.model.findByPk(id);
    }

    async findByPkPlain(id: string | number): Promise<T | null> {
        const row = await this.model.findByPk(id, {raw: true});
        return row ? {...row} : null;
    }

    async update(
        attributes: CreationAttributes<T>,
        where: WhereOptions<Attributes<T>>
    ): Promise<[number, T[]]> {
        const result = await this.model.update(attributes, {
            where,
            returning: true
        } as UpdateOptions<Attributes<T>>);

        // result might be [number] or [number, T[]]
        const [affectedCount, rows] = result as unknown as [number, T[] | undefined];

        // Normalize rows (only if provided)
        const cleanRows = rows ? rows.map(r => r.get({plain: true})) : [];

        return [affectedCount, cleanRows];
    }

    async remove(where: WhereOptions<Attributes<T>>): Promise<number> {
        return await this.model.destroy({where} as DestroyOptions<Attributes<T>>);
    }
}
