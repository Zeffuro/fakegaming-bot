import {Model, ModelCtor} from 'sequelize-typescript';
import {
    CreationAttributes,
    DestroyOptions,
    FindAndCountOptions,
    FindOrCreateOptions,
    FindOptions,
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

    async getMany(where: WhereOptions<Attributes<T>>): Promise<T[]> {
        return await this.model.findAll({where});
    }

    async add(config: CreationAttributes<T>): Promise<T> {
        return await this.model.create(config);
    }

    async upsert(item: CreationAttributes<T>): Promise<boolean> {
        const [_, created] = await this.model.upsert(item);
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
        return await this.model.findAndCountAll(options);
    }

    async findByPk(id: any): Promise<T | null> {
        return await this.model.findByPk(id);
    }

    async update(attributes: CreationAttributes<T>, where: WhereOptions<Attributes<T>>): Promise<[number, T[]]> {
        const result = await this.model.update(attributes, {
            where,
            returning: true
        } as UpdateOptions<Attributes<T>>);

        const affectedCount: number = Array.isArray(result) ? result[0] : result;
        const affectedRows: T[] = [];

        return [affectedCount, affectedRows];
    }

    async remove(where: WhereOptions<Attributes<T>>): Promise<number> {
        return await this.model.destroy({where} as DestroyOptions<Attributes<T>>);
    }
}