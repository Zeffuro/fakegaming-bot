import {Table, Column, Model, DataType, PrimaryKey} from 'sequelize-typescript';

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
}