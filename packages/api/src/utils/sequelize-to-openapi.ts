import {Model} from 'sequelize-typescript';
import { mapSequelizeTypeToOpenAPI } from '@zeffuro/fakegaming-common';

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
        properties[name] = { ...typeInfo };
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
