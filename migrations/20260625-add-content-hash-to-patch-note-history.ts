interface MigrationSequelize {
    query(sql: string): Promise<unknown>;
}

const TABLE = 'PatchNoteHistoryConfigs';
const INDEX = 'patch_note_history_game_content_hash';

export const up = async ({ context }: { context: MigrationSequelize }) => {
    await context.query(`ALTER TABLE "${TABLE}" ADD COLUMN "contentHash" VARCHAR(255)`);
    await context.query(`CREATE INDEX IF NOT EXISTS "${INDEX}" ON "${TABLE}" ("game", "contentHash")`);
};

export const down = async ({ context }: { context: MigrationSequelize }) => {
    await context.query(`DROP INDEX IF EXISTS "${INDEX}"`);
    await context.query(`ALTER TABLE "${TABLE}" DROP COLUMN "contentHash"`);
};
