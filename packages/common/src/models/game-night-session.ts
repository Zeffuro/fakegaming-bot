import { Column, DataType, Model, PrimaryKey, Table } from 'sequelize-typescript';

export type GameNightState = 'nominating' | 'voting' | 'finished' | 'expired';

@Table({ tableName: 'GameNightSessions' })
export class GameNightSession extends Model {
    @PrimaryKey
    @Column(DataType.STRING)
    declare id: string;

    @Column(DataType.STRING)
    declare guildId: string;

    @Column(DataType.STRING)
    declare channelId: string;

    @Column(DataType.STRING)
    declare messageId: string | null;

    @Column(DataType.STRING)
    declare creatorId: string;

    @Column(DataType.STRING)
    declare name: string;

    @Column(DataType.STRING)
    declare state: GameNightState;

    @Column(DataType.STRING)
    declare activeKey: string | null;

    @Column(DataType.BIGINT)
    declare expiresAt: number;

    @Column(DataType.STRING)
    declare winnerNominationId: string | null;

    @Column(DataType.TEXT)
    declare tieBreakCandidateIds: string | null;

    @Column(DataType.INTEGER)
    declare tieBreakIndex: number | null;

    @Column(DataType.INTEGER)
    declare version: number;
}
