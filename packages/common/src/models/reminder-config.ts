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
}