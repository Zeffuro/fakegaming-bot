import {Table, Column, Model, DataType, PrimaryKey, Default} from 'sequelize-typescript';

export const QUOTE_MODERATION_STATUSES = ['pending', 'approved', 'rejected'] as const;
export type QuoteModerationStatus = typeof QUOTE_MODERATION_STATUSES[number];

@Table
export class QuoteConfig extends Model {
    @PrimaryKey
    @Column(DataType.STRING)
    declare id: string;

    @Column(DataType.STRING)
    declare guildId: string;

    @Column(DataType.TEXT)
    declare quote: string;

    @Column(DataType.STRING)
    declare authorId: string;

    @Column(DataType.STRING)
    declare submitterId: string;

    @Column(DataType.BIGINT)
    declare timestamp: number;

    @Column(DataType.TEXT)
    declare tags?: string | null;

    @Column(DataType.STRING)
    declare source?: string | null;

    @Column(DataType.TEXT)
    declare context?: string | null;

    @Default('pending')
    @Column(DataType.STRING(16))
    declare moderationStatus: QuoteModerationStatus;
}
