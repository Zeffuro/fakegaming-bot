import { Column, DataType, Model, PrimaryKey, Table } from 'sequelize-typescript';

export type PollCloseReason = 'creator' | 'moderator' | 'expired';

@Table({ tableName: 'PollSessions' })
export class PollSession extends Model {
    @PrimaryKey
    @Column(DataType.STRING)
    declare id: string;

    @Column(DataType.STRING)
    declare guildId: string;

    @Column(DataType.STRING)
    declare channelId: string;

    @Column(DataType.STRING)
    declare messageId: string;

    @Column(DataType.STRING)
    declare creatorId: string;

    @Column(DataType.STRING)
    declare question: string;

    @Column(DataType.TEXT)
    declare optionsJson: string;

    @Column(DataType.TEXT)
    declare votesJson: string;

    @Column(DataType.BOOLEAN)
    declare allowMultiple: boolean;

    @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false })
    declare hideResults: boolean;

    @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false })
    declare ranked: boolean;

    @Column(DataType.STRING)
    declare locale: string;

    @Column({ type: DataType.INTEGER, allowNull: true })
    declare durationMinutes: number | null;

    @Column(DataType.BIGINT)
    declare expiresAt: number;

    @Column(DataType.BIGINT)
    declare closedAt: number | null;

    @Column(DataType.STRING)
    declare closeReason: PollCloseReason | null;

    @Column(DataType.BOOLEAN)
    declare renderPending: boolean;

    @Column(DataType.INTEGER)
    declare version: number;
}
