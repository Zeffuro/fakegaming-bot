interface MigrationSequelize {
    getDialect(): string;
    query(sql: string): Promise<unknown>;
}

export const up = async ({ context }: { context: MigrationSequelize }) => {
    await context.query('ALTER TABLE "LeagueConfigs" ADD COLUMN "riotIdGameName" VARCHAR(255)');
    await context.query('ALTER TABLE "LeagueConfigs" ADD COLUMN "riotIdTagLine" VARCHAR(255)');

    if (context.getDialect() === 'sqlite') {
        await context.query(`
            UPDATE "LeagueConfigs"
            SET
                "riotIdGameName" = CASE
                    WHEN instr("summonerName", '#') > 0 THEN substr("summonerName", 1, instr("summonerName", '#') - 1)
                    ELSE "summonerName"
                END,
                "riotIdTagLine" = CASE
                    WHEN instr("summonerName", '#') > 0 THEN substr("summonerName", instr("summonerName", '#') + 1)
                    ELSE NULL
                END
            WHERE "riotIdGameName" IS NULL
        `);
        return;
    }

    await context.query(`
        UPDATE "LeagueConfigs"
        SET
            "riotIdGameName" = CASE
                WHEN POSITION('#' IN "summonerName") > 0 THEN SPLIT_PART("summonerName", '#', 1)
                ELSE "summonerName"
            END,
            "riotIdTagLine" = CASE
                WHEN POSITION('#' IN "summonerName") > 0 THEN SPLIT_PART("summonerName", '#', 2)
                ELSE NULL
            END
        WHERE "riotIdGameName" IS NULL
    `);
};

export const down = async ({ context }: { context: MigrationSequelize }) => {
    await context.query('ALTER TABLE "LeagueConfigs" DROP COLUMN "riotIdTagLine"');
    await context.query('ALTER TABLE "LeagueConfigs" DROP COLUMN "riotIdGameName"');
};
