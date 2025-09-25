import {Table, Column, Model, DataType, Unique} from 'sequelize-typescript';

@Table
export class PatchNoteConfig extends Model {
    @Unique
    @Column(DataType.STRING)
    declare game: string;

    @Column(DataType.STRING)
    declare title: string;

    @Column(DataType.TEXT)
    declare content: string;

    @Column(DataType.STRING)
    declare url: string;

    @Column(DataType.BIGINT)
    declare publishedAt: number;

    @Column(DataType.STRING)
    declare logoUrl?: string;

    @Column(DataType.STRING)
    declare imageUrl?: string;

    @Column(DataType.STRING)
    declare version?: string;

    @Column(DataType.INTEGER)
    declare accentColor?: number;
}