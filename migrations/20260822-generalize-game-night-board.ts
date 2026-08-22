interface MigrationContext {
    query(sql: string): Promise<unknown>;
}

export const up = async ({ context }: { context: MigrationContext }) => {
    await context.query(`ALTER TABLE "GameNightSessions"
        ADD COLUMN "kind" VARCHAR(16) NOT NULL DEFAULT 'game'
        CHECK ("kind" IN ('game', 'movie'))`);
    await context.query(`ALTER TABLE "GameNightSessions"
        ADD COLUMN "allowMultipleNominations" BOOLEAN NOT NULL DEFAULT FALSE`);
    await context.query('DROP INDEX IF EXISTS "ux_game_night_nomination_user"');
    await context.query(`UPDATE "DisabledCommandConfigs"
        SET "commandName" = 'night'
        WHERE "commandName" = 'game-night'`);
};

export const down = async ({ context }: { context: MigrationContext }) => {
    await context.query(`UPDATE "DisabledCommandConfigs"
        SET "commandName" = 'game-night'
        WHERE "commandName" = 'night'`);
    await context.query(`DELETE FROM "GameNightNominations"
        WHERE "id" IN (
            SELECT "id"
            FROM (
                SELECT
                    "id",
                    ROW_NUMBER() OVER (
                        PARTITION BY "sessionId", "userId"
                        ORDER BY "createdAt" ASC, "id" ASC
                    ) AS "nominationRank"
                FROM "GameNightNominations"
            ) AS "rankedNominations"
            WHERE "nominationRank" > 1
        )`);
    await context.query('CREATE UNIQUE INDEX IF NOT EXISTS "ux_game_night_nomination_user" ON "GameNightNominations" ("sessionId", "userId")');
    await context.query('ALTER TABLE "GameNightSessions" DROP COLUMN "allowMultipleNominations"');
    await context.query('ALTER TABLE "GameNightSessions" DROP COLUMN "kind"');
};
