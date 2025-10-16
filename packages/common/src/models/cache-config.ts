import {Table, Column, Model, DataType, PrimaryKey, AllowNull} from 'sequelize-typescript';

@Table({ tableName: 'CacheConfig', timestamps: false })
export class CacheConfig extends Model {
    @PrimaryKey
    @AllowNull(false)
    @Column(DataType.STRING)
    declare key: string;

    @AllowNull(false)
    @Column(DataType.TEXT)
    declare value: string;

    @AllowNull(false)
    @Column(DataType.DATE)
    declare expires: Date;
}