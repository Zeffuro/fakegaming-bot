import {Table, Column, Model, DataType, PrimaryKey, Unique} from 'sequelize-typescript';

@Table
export class BirthdayConfig extends Model {
    @PrimaryKey
    @Unique('unique_user_guild_birthday')
    @Column(DataType.STRING)
    declare userId: string;

    @Column(DataType.INTEGER)
    declare day: number;

    @Column(DataType.INTEGER)
    declare month: number;

    @Column(DataType.INTEGER)
    declare year?: number;

    @Unique('unique_user_guild_birthday')
    @Column(DataType.STRING)
    declare guildId: string;

    @Column(DataType.STRING)
    declare channelId: string;
}