#!/usr/bin/env node

/**
 * Generator script for creating new database tables with the single-source-of-truth architecture.
 *
 * Usage:
 *   node scripts/generate-table.js MyTableName field1:string field2:number field3:string?
 *
 * Example:
 *   node scripts/generate-table.js UserProfile username:string age:number bio:string?
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const args = process.argv.slice(2);

if (args.length < 2) {
    console.error('❌ Usage: node scripts/generate-table.js TableName field1:type field2:type ...');
    console.error('   Types: string, number, boolean, date, text, bigint');
    console.error('   Optional: Add ? after type (e.g., field:string?)');
    process.exit(1);
}

const tableName = args[0];
const fields = args.slice(1);

// Parse fields
const parsedFields = fields.map(field => {
    const [name, typeSpec] = field.split(':');
    const isOptional = typeSpec?.endsWith('?');
    const type = isOptional ? typeSpec.slice(0, -1) : typeSpec;

    const typeMap = {
        'string': 'DataType.STRING',
        'text': 'DataType.TEXT',
        'number': 'DataType.INTEGER',
        'bigint': 'DataType.BIGINT',
        'boolean': 'DataType.BOOLEAN',
        'date': 'DataType.DATE',
    };

    return {
        name,
        type: typeMap[type] || 'DataType.STRING',
        optional: isOptional
    };
});

// Generate model file
const modelTemplate = `import { Table, Column, Model, DataType, PrimaryKey, AutoIncrement } from 'sequelize-typescript';

@Table
export class ${tableName} extends Model {
    @PrimaryKey
    @AutoIncrement
    @Column(DataType.INTEGER)
    declare id: number;

${parsedFields.map(f => `    @Column(${f.type})
    declare ${f.name}${f.optional ? '?' : ''}: ${f.type.includes('INTEGER') || f.type.includes('BIGINT') ? 'number' : f.type.includes('BOOLEAN') ? 'boolean' : f.type.includes('DATE') ? 'Date' : 'string'};`).join('\n\n')}
}
`;

// Generate manager file
const managerName = `${tableName}Manager`;
const managerTemplate = `import { BaseManager } from './baseManager.js';
import { ${tableName} } from '../models/${toKebabCase(tableName)}.js';

export class ${managerName} extends BaseManager<${tableName}> {
    constructor() {
        super(${tableName});
    }

    // Add custom methods here if needed
}
`;

// Generate migration file
const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '');
const migrationTemplate = `import { DataTypes } from 'sequelize';
import type { Migration } from '../packages/common/src/core/migrationTypes.js';

export const up: Migration = async ({ context: sequelize }) => {
    await sequelize.getQueryInterface().createTable('${tableName}s', {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
${parsedFields.map(f => `        ${f.name}: {
            type: ${f.type.replace('DataType.', 'DataTypes.')},
            allowNull: ${f.optional},
        },`).join('\n')}
        createdAt: {
            type: DataTypes.DATE,
            allowNull: false,
        },
        updatedAt: {
            type: DataTypes.DATE,
            allowNull: false,
        },
    });
};

export const down: Migration = async ({ context: sequelize }) => {
    await sequelize.getQueryInterface().dropTable('${tableName}s');
};
`;

// Write files
const commonPath = join(__dirname, '..', 'packages', 'common', 'src');
const modelPath = join(commonPath, 'models', `${toKebabCase(tableName)}.ts`);
const managerPath = join(commonPath, 'managers', `${toKebabCase(tableName)}Manager.ts`);
const migrationPath = join(__dirname, '..', 'migrations', `${timestamp}-create-${toKebabCase(tableName)}.ts`);

try {
    writeFileSync(modelPath, modelTemplate);
    console.log(`✅ Created model: ${modelPath}`);

    writeFileSync(managerPath, managerTemplate);
    console.log(`✅ Created manager: ${managerPath}`);

    writeFileSync(migrationPath, migrationTemplate);
    console.log(`✅ Created migration: ${migrationPath}`);

    console.log('\n📝 Next steps:');
    console.log(`1. Export ${tableName} in packages/common/src/models/index.ts`);
    console.log(`2. Export ${managerName} in packages/common/src/managers/index.ts`);
    console.log(`3. Add ${managerName} to ConfigManager`);
    console.log(`4. Run: pnpm run migrate:up`);
    console.log(`5. Use schemaRegistry.getCreateSchema(${tableName}) in your routes!`);

} catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
}

function toKebabCase(str) {
    return str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

