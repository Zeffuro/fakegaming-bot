import {Model} from 'sequelize-typescript';

/**
 * Maps Sequelize DataTypes to OpenAPI types and formats.
 */
function mapSequelizeTypeToOpenAPI(type: any): { type: string; format?: string } {
    const typeName = type?.constructor?.name || '';
    switch (typeName) {
        case 'STRING':
        case 'TEXT':
        case 'UUID':
            return {type: 'string'};
        case 'INTEGER':
        case 'BIGINT':
            return {type: 'integer', format: 'int64'};
        case 'FLOAT':
        case 'DOUBLE':
        case 'DECIMAL':
            return {type: 'number', format: 'float'};
        case 'BOOLEAN':
            return {type: 'boolean'};
        case 'DATE':
            return {type: 'string', format: 'date-time'};
        default:
            return {type: 'string'};
    }
}

/**
 * Generates an OpenAPI schema object from a Sequelize model class.
 */
export function sequelizeModelToOpenAPISchema(modelClass: typeof Model): any {
    // @ts-ignore
    const attributes: { [key: string]: any } = modelClass.getAttributes();
    const properties: Record<string, any> = {};
    const required: string[] = [];

    for (const [name, attr] of Object.entries(attributes)) {
        // @ts-ignore
        const typeInfo = mapSequelizeTypeToOpenAPI(attr.type);
        properties[name] = {...typeInfo};
        if (attr.allowNull === false || attr.primaryKey) {
            required.push(name);
        }
    }

    return {
        type: 'object',
        properties,
        required: required.length > 0 ? required : undefined,
    };
}
