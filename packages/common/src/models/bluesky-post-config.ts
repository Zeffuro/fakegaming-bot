import { Table, Column, Model, DataType, PrimaryKey, AutoIncrement, Unique } from 'sequelize-typescript';

@Table
export class BlueskyPostConfig extends Model {
    @PrimaryKey
    @AutoIncrement
    @Column(DataType.INTEGER)
    declare id: number;

    @Unique('unique_guild_bluesky_handle')
    @Column(DataType.STRING)
    declare blueskyHandle: string;

    @Column(DataType.STRING)
    declare discordChannelId: string;

    @Column(DataType.STRING)
    declare lastPostUri?: string | null;

    @Column(DataType.STRING)
    declare lastPostCid?: string | null;

    @Column(DataType.TEXT)
    declare customMessage?: string;

    @Column(DataType.INTEGER)
    declare cooldownMinutes?: number | null;

    @Column(DataType.STRING)
    declare quietHoursStart?: string | null;

    @Column(DataType.STRING)
    declare quietHoursEnd?: string | null;

    @Column(DataType.DATE)
    declare lastNotifiedAt?: Date | null;

    @Unique('unique_guild_bluesky_handle')
    @Column(DataType.STRING)
    declare guildId: string;
}
