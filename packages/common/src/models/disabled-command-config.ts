import {Table, Column, Model, DataType, PrimaryKey, AutoIncrement} from 'sequelize-typescript';

@Table
export class DisabledCommandConfig extends Model {
    @PrimaryKey
    @AutoIncrement
    @Column(DataType.INTEGER)
    declare id: number;

    @Column(DataType.STRING)
    declare guildId: string;

    @Column(DataType.STRING)
    declare commandName: string;
}