# Database Migrations Guide

This project uses [Umzug](https://github.com/sequelize/umzug) with Sequelize for database migrations.

## Overview

All database schema changes **must** be done through migrations. This ensures:
- Schema changes are version-controlled
- Changes can be applied consistently across environments
- Changes can be rolled back if needed
- Team members stay in sync with database structure

## Migration Files

Location: `migrations/` (project root)

### File Naming Convention

```
YYYYMMDD-description.ts
```

Examples:
- `20250923-add-nickname-to-config.ts`
- `20250929-create-disabled-command-config.ts`
- `20250930-add-guildId-to-patch-subscription-config.ts`

**Important:** Always use the date format `YYYYMMDD` so migrations run in chronological order.

### Migration Structure

Each migration file exports two functions:

```typescript
import { DataTypes, Sequelize } from 'sequelize';

export const up = async ({ context }: { context: Sequelize }) => {
    const qi = context.getQueryInterface();
    
    // Apply changes (add tables, columns, etc.)
    await qi.createTable('TableName', {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        // ... other columns
    });
};

export const down = async ({ context }: { context: Sequelize }) => {
    const qi = context.getQueryInterface();
    
    // Revert changes (for rollback)
    await qi.dropTable('TableName');
};
```

## Common Migration Operations

### Creating a Table

```typescript
export const up = async ({ context }: { context: Sequelize }) => {
    const qi = context.getQueryInterface();
    
    await qi.createTable('MyTable', {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        name: { type: DataTypes.STRING, allowNull: false },
        guildId: { type: DataTypes.STRING, allowNull: false },
        createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
};

export const down = async ({ context }: { context: Sequelize }) => {
    const qi = context.getQueryInterface();
    await qi.dropTable('MyTable');
};
```

### Adding a Column

```typescript
export const up = async ({ context }: { context: Sequelize }) => {
    const qi = context.getQueryInterface();
    
    await qi.addColumn('ExistingTable', 'newColumn', {
        type: DataTypes.STRING,
        allowNull: true,
    });
};

export const down = async ({ context }: { context: Sequelize }) => {
    const qi = context.getQueryInterface();
    await qi.removeColumn('ExistingTable', 'newColumn');
};
```

### Adding an Index

```typescript
export const up = async ({ context }: { context: Sequelize }) => {
    const qi = context.getQueryInterface();
    
    await qi.addIndex('TableName', ['columnName'], {
        unique: true,
        name: 'unique_column_name',
    });
};

export const down = async ({ context }: { context: Sequelize }) => {
    const qi = context.getQueryInterface();
    await qi.removeIndex('TableName', 'unique_column_name');
};
```

### Adding a Constraint

```typescript
export const up = async ({ context }: { context: Sequelize }) => {
    const qi = context.getQueryInterface();
    
    await qi.addConstraint('TableName', {
        fields: ['field1', 'field2'],
        type: 'unique',
        name: 'unique_field1_field2',
    });
};

export const down = async ({ context }: { context: Sequelize }) => {
    const qi = context.getQueryInterface();
    await qi.removeConstraint('TableName', 'unique_field1_field2');
};
```

### Changing a Column Type

```typescript
export const up = async ({ context }: { context: Sequelize }) => {
    const qi = context.getQueryInterface();
    
    await qi.changeColumn('TableName', 'columnName', {
        type: DataTypes.TEXT, // Changed from STRING
        allowNull: false,
    });
};

export const down = async ({ context }: { context: Sequelize }) => {
    const qi = context.getQueryInterface();
    
    await qi.changeColumn('TableName', 'columnName', {
        type: DataTypes.STRING, // Revert to original
        allowNull: false,
    });
};
```

## Running Migrations

Migrations are automatically run when the bot or API starts. The system tracks which migrations have been applied in the `SequelizeMeta` table.

### Automatic Execution

The bot and API automatically run pending migrations on startup:

```typescript
// In packages/bot/src/index.ts and packages/api/src/index.ts
import { runMigrations } from '@zeffuro/fakegaming-common';
import { getSequelize } from '@zeffuro/fakegaming-common';

const sequelize = getSequelize();
await runMigrations(sequelize);
```

### Manual Execution (Development)

If you need to run migrations manually during development:

```bash
# From the bot package
cd packages/bot
pnpm start:dev  # Migrations run automatically on startup

# From the API package
cd packages/api
pnpm start:dev  # Migrations run automatically on startup
```

## Writing Good Migrations

### Best Practices

1. **Always provide `down` migrations** - Allow rollback if something goes wrong
2. **Test migrations locally first** - Run on development database before production
3. **One logical change per migration** - Don't combine unrelated changes
4. **Use descriptive names** - Make it clear what the migration does
5. **Include timestamps** - Use `YYYYMMDD` format in filename
6. **Add default values** - Use `defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')` for timestamps
7. **Consider data migration** - If changing column types, migrate existing data

### Migration Checklist

Before committing a migration:

- [ ] Migration file follows naming convention (`YYYYMMDD-description.ts`)
- [ ] Both `up` and `down` functions are implemented
- [ ] Migration tested locally (applied and rolled back)
- [ ] Corresponding model changes are made in `packages/common/src/models/`
- [ ] TypeScript types updated if needed
- [ ] Migration works with both SQLite (dev) and PostgreSQL (prod)

## Database-Specific Considerations

### SQLite (Development)

- Supports most operations but has limitations
- Cannot drop columns (workaround: create new table, copy data, drop old table)
- Limited `ALTER TABLE` support

### PostgreSQL (Production)

- Full support for all migration operations
- Better performance for large datasets
- Use `SERIAL` instead of `AUTOINCREMENT` for auto-increment columns

### Cross-Database Compatibility

To ensure migrations work in both environments:

```typescript
// Good - Works in both SQLite and PostgreSQL
await qi.addColumn('TableName', 'newColumn', {
    type: DataTypes.STRING,
    allowNull: true,
});

// Good - Use CURRENT_TIMESTAMP for timestamps
createdAt: { 
    type: DataTypes.DATE, 
    allowNull: false, 
    defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') 
}

// Avoid - Database-specific syntax
// await qi.sequelize.query('ALTER TABLE ... (PostgreSQL-specific syntax)');
```

## Migration Workflow

### Adding a New Feature

1. **Design the schema change**
   ```
   Need to add "nickname" field to UserConfig
   ```

2. **Create migration file**
   ```bash
   # Create: migrations/20250923-add-nickname-to-config.ts
   ```

3. **Write migration**
   ```typescript
   export const up = async ({ context }: { context: Sequelize }) => {
       const qi = context.getQueryInterface();
       await qi.addColumn('UserConfigs', 'nickname', {
           type: DataTypes.STRING,
           allowNull: true,
       });
   };

   export const down = async ({ context }: { context: Sequelize }) => {
       const qi = context.getQueryInterface();
       await qi.removeColumn('UserConfigs', 'nickname');
   };
   ```

4. **Update the model**
   ```typescript
   // packages/common/src/models/user-config.ts
   @Column({ type: DataTypes.STRING, allowNull: true })
   nickname?: string;
   ```

5. **Test locally**
   ```bash
   pnpm start:bot:dev  # Migration runs automatically
   ```

6. **Verify changes**
   - Check database schema
   - Test bot functionality
   - Verify rollback works

7. **Commit changes**
   ```bash
   git add migrations/20250923-add-nickname-to-config.ts
   git add packages/common/src/models/user-config.ts
   git commit -m "feat: add nickname field to user config"
   ```

## Troubleshooting

### Migration Already Applied

If you need to rerun a migration:

1. Delete the entry from `SequelizeMeta` table:
   ```sql
   DELETE FROM "SequelizeMeta" WHERE name = '20250923-add-nickname-to-config.ts';
   ```

2. Restart the bot/API to rerun the migration

### Migration Failed

If a migration fails:

1. Check error message for details
2. Fix the migration file
3. Drop the database or manually rollback changes
4. Restart to rerun migrations

### Rollback Not Working

If `down` migration fails:

1. Manually revert database changes
2. Fix the `down` function
3. Test rollback before committing

## Advanced Topics

### Data Migrations

When changing column types or structure, migrate existing data:

```typescript
export const up = async ({ context }: { context: Sequelize }) => {
    const qi = context.getQueryInterface();
    
    // 1. Add new column
    await qi.addColumn('Users', 'emailVerified', {
        type: DataTypes.BOOLEAN,
        allowNull: true,
    });
    
    // 2. Migrate existing data
    await qi.sequelize.query(
        'UPDATE "Users" SET "emailVerified" = true WHERE "email" IS NOT NULL'
    );
    
    // 3. Make column non-nullable
    await qi.changeColumn('Users', 'emailVerified', {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
    });
};
```

### Handling Large Datasets

For tables with millions of rows:

```typescript
export const up = async ({ context }: { context: Sequelize }) => {
    const qi = context.getQueryInterface();
    
    // Add column as nullable first
    await qi.addColumn('LargeTable', 'newColumn', {
        type: DataTypes.STRING,
        allowNull: true,
    });
    
    // Migrate data in batches (if needed)
    // await qi.sequelize.query('UPDATE "LargeTable" SET ...');
    
    // Then add constraints in a later migration
};
```

## References

- [Umzug Documentation](https://github.com/sequelize/umzug)
- [Sequelize QueryInterface](https://sequelize.org/api/v6/class/src/dialects/abstract/query-interface.js~queryinterface)
- [Sequelize Data Types](https://sequelize.org/docs/v6/core-concepts/model-basics/#data-types)

---

**Questions?** Check existing migrations in `migrations/` for examples, or ask in the project repository.

