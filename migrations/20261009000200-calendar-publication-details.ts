interface MigrationContext { query(sql: string): Promise<unknown> }

export async function up({ context }: { context: MigrationContext }): Promise<void> {
    await context.query('ALTER TABLE "CalendarPublications" ADD COLUMN "includeEventDetails" BOOLEAN NOT NULL DEFAULT false');
    await context.query('ALTER TABLE "CalendarEventSnapshots" ADD COLUMN "htmlLink" VARCHAR(2048)');
    await context.query('ALTER TABLE "CalendarEventSnapshots" ADD COLUMN "location" VARCHAR(100)');
    await context.query('ALTER TABLE "CalendarEventSnapshots" ADD COLUMN "description" VARCHAR(1000)');
}

export async function down({ context }: { context: MigrationContext }): Promise<void> {
    for (const column of ['description', 'location', 'htmlLink']) {
        await context.query(`ALTER TABLE "CalendarEventSnapshots" DROP COLUMN "${column}"`);
    }
    await context.query('ALTER TABLE "CalendarPublications" DROP COLUMN "includeEventDetails"');
}
