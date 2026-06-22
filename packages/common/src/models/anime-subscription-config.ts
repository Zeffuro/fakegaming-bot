import { AutoIncrement, Column, DataType, Model, PrimaryKey, Table } from 'sequelize-typescript';

@Table
export class AnimeSubscriptionConfig extends Model {
    @PrimaryKey
    @AutoIncrement
    @Column(DataType.INTEGER)
    declare id: number;

    @Column(DataType.INTEGER)
    declare anilistId: number;

    @Column(DataType.STRING)
    declare targetType: 'dm' | 'channel';

    @Column(DataType.STRING)
    declare userId?: string | null;

    @Column(DataType.STRING)
    declare guildId?: string | null;

    @Column(DataType.STRING)
    declare channelId?: string | null;

    @Column(DataType.INTEGER)
    declare reminderMinutes: number;

    @Column(DataType.INTEGER)
    declare lastNotifiedEpisode?: number | null;

    @Column(DataType.BIGINT)
    declare lastNotifiedAiringAt?: number | null;

    @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false })
    declare paused: boolean;
}
