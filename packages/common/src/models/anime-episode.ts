import { AutoIncrement, Column, DataType, Model, PrimaryKey, Table, Unique } from 'sequelize-typescript';

@Table
export class AnimeEpisode extends Model {
    @PrimaryKey
    @AutoIncrement
    @Column(DataType.INTEGER)
    declare id: number;

    @Unique('unique_anime_episode')
    @Column(DataType.INTEGER)
    declare anilistId: number;

    @Unique('unique_anime_episode')
    @Column(DataType.INTEGER)
    declare episode: number;

    @Column(DataType.BIGINT)
    declare airingAt: number;
}
