interface MigrationContext {
    query(sql: string): Promise<unknown>;
}

export const up = async ({ context }: { context: MigrationContext }) => {
    await context.query(`CREATE TABLE IF NOT EXISTS "GameNightSessions" (
        "id" VARCHAR(64) PRIMARY KEY,
        "guildId" VARCHAR(32) NOT NULL,
        "channelId" VARCHAR(32) NOT NULL,
        "messageId" VARCHAR(32),
        "creatorId" VARCHAR(32) NOT NULL,
        "name" VARCHAR(80) NOT NULL,
        "state" VARCHAR(16) NOT NULL,
        "activeKey" VARCHAR(32),
        "expiresAt" BIGINT NOT NULL,
        "winnerNominationId" VARCHAR(64),
        "tieBreakCandidateIds" TEXT,
        "tieBreakIndex" INTEGER,
        "version" INTEGER NOT NULL,
        "createdAt" TIMESTAMP NOT NULL,
        "updatedAt" TIMESTAMP NOT NULL
    )`);
    await context.query(`CREATE TABLE IF NOT EXISTS "GameNightNominations" (
        "id" VARCHAR(64) PRIMARY KEY,
        "sessionId" VARCHAR(64) NOT NULL REFERENCES "GameNightSessions" ("id") ON DELETE CASCADE,
        "userId" VARCHAR(32) NOT NULL,
        "gameName" VARCHAR(80) NOT NULL,
        "normalizedName" VARCHAR(80) NOT NULL,
        "createdAt" TIMESTAMP NOT NULL,
        "updatedAt" TIMESTAMP NOT NULL
    )`);
    await context.query(`CREATE TABLE IF NOT EXISTS "GameNightVotes" (
        "sessionId" VARCHAR(64) NOT NULL REFERENCES "GameNightSessions" ("id") ON DELETE CASCADE,
        "userId" VARCHAR(32) NOT NULL,
        "nominationId" VARCHAR(64) NOT NULL REFERENCES "GameNightNominations" ("id") ON DELETE CASCADE,
        "createdAt" TIMESTAMP NOT NULL,
        "updatedAt" TIMESTAMP NOT NULL,
        PRIMARY KEY ("sessionId", "userId")
    )`);
    await context.query('CREATE UNIQUE INDEX IF NOT EXISTS "ux_game_night_active_guild" ON "GameNightSessions" ("activeKey")');
    await context.query('CREATE UNIQUE INDEX IF NOT EXISTS "ux_game_night_nomination_name" ON "GameNightNominations" ("sessionId", "normalizedName")');
    await context.query('CREATE UNIQUE INDEX IF NOT EXISTS "ux_game_night_nomination_user" ON "GameNightNominations" ("sessionId", "userId")');
    await context.query('CREATE INDEX IF NOT EXISTS "ix_game_night_expiry" ON "GameNightSessions" ("state", "expiresAt")');
    await context.query('CREATE INDEX IF NOT EXISTS "ix_game_night_votes_nomination" ON "GameNightVotes" ("sessionId", "nominationId")');
};

export const down = async ({ context }: { context: MigrationContext }) => {
    await context.query('DROP TABLE IF EXISTS "GameNightVotes"');
    await context.query('DROP TABLE IF EXISTS "GameNightNominations"');
    await context.query('DROP TABLE IF EXISTS "GameNightSessions"');
};
