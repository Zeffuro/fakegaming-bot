import { Column, DataType, Model, PrimaryKey, Table } from 'sequelize-typescript';

@Table({ tableName: 'GameNightNominations' })
export class GameNightNomination extends Model {
    @PrimaryKey
    @Column(DataType.STRING)
    declare id: string;

    @Column(DataType.STRING)
    declare sessionId: string;

    @Column(DataType.STRING)
    declare userId: string;

    @Column(DataType.STRING)
    declare gameName: string;

    @Column(DataType.STRING)
    declare normalizedName: string;
}
