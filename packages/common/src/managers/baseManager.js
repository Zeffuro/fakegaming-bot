export class BaseManager {
    model;
    constructor(model) {
        this.model = model;
    }
    async getAll() {
        return await this.model.findAll();
    }
    async set(item, primaryKeyName) {
        const [record, created] = await this.model.findOrCreate({
            where: {
                [primaryKeyName]: item[primaryKeyName]
            },
            defaults: item,
        });
        if (!created) {
            await record.update(item);
        }
        return [record, created];
    }
    async getOne(where) {
        return await this.model.findOne({ where });
    }
    async getMany(where) {
        return await this.model.findAll({ where });
    }
    async add(config) {
        return await this.model.create(config);
    }
    async upsert(item) {
        const [_, created] = await this.model.upsert(item);
        return created || false;
    }
    async findOrCreate(config) {
        const [record, created] = await this.model.findOrCreate(config);
        return [record, created];
    }
    async exists(where) {
        const result = await this.model.findOne({ where, attributes: ['id'] });
        return !!result;
    }
    async getAndCountAll(options) {
        return await this.model.findAndCountAll(options);
    }
    async findByPk(id) {
        return await this.model.findByPk(id);
    }
    async update(attributes, where) {
        const result = await this.model.update(attributes, {
            where,
            returning: true
        });
        const affectedCount = Array.isArray(result) ? result[0] : result;
        const affectedRows = [];
        return [affectedCount, affectedRows];
    }
    async remove(where) {
        return await this.model.destroy({ where });
    }
}
