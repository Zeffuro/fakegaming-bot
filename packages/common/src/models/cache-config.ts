import {Table, Column, Model, DataType, PrimaryKey} from 'sequelize-typescript';

@Table
export class CacheConfig extends Model {
    @PrimaryKey
    @Column(DataType.STRING)
    declare key: string;

    @Column(DataType.TEXT)
    declare value: string;

    @Column(DataType.DATE)
    declare expires: Date;
}