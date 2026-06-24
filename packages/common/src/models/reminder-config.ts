import {Table, Column, Model, DataType, PrimaryKey} from 'sequelize-typescript';

@Table
export class ReminderConfig extends Model {
    @PrimaryKey
    @Column(DataType.STRING)
    declare id: string;

    @Column(DataType.STRING)
    declare userId: string;

    @Column(DataType.TEXT)
    declare message: string;

    @Column(DataType.STRING)
    declare timespan: string;

    @Column(DataType.BIGINT)
    declare timestamp: number;

    @Column(DataType.BOOLEAN)
    declare completed?: boolean;

    @Column(DataType.STRING)
    declare recurrenceUnit?: string | null;

    @Column(DataType.INTEGER)
    declare recurrenceInterval?: number | null;

    @Column(DataType.STRING)
    declare recurrenceTimezone?: string | null;

    @Column(DataType.BIGINT)
    declare lastTriggeredAt?: number | null;
}
