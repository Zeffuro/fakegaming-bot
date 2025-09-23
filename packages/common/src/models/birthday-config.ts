import {Table, Column, Model, DataType, PrimaryKey} from 'sequelize-typescript';

@Table
export class BirthdayConfig extends Model {
    @PrimaryKey
    @Column(DataType.STRING)
    declare userId: string;

    @Column(DataType.INTEGER)
    declare day: number;

    @Column(DataType.INTEGER)
    declare month: number;

    @Column(DataType.INTEGER)
    declare year?: number;

    @Column(DataType.STRING)
    declare guildId: string;

    @Column(DataType.STRING)
    declare channelId: string;
}