import {Table, Column, Model, DataType, PrimaryKey} from 'sequelize-typescript';

@Table
export class ServerConfig extends Model {
    @PrimaryKey
    @Column(DataType.STRING)
    declare serverId: string;

    @Column(DataType.STRING)
    declare prefix: string;

    @Column(DataType.TEXT)
    declare welcomeMessage?: string;
}