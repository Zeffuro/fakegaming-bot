var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Table, Column, Model, DataType, PrimaryKey, HasOne } from 'sequelize-typescript';
import { LeagueConfig } from './league-config.js';
let UserConfig = class UserConfig extends Model {
};
__decorate([
    PrimaryKey,
    Column(DataType.STRING)
], UserConfig.prototype, "discordId", void 0);
__decorate([
    Column(DataType.STRING)
], UserConfig.prototype, "nickname", void 0);
__decorate([
    HasOne(() => LeagueConfig)
], UserConfig.prototype, "league", void 0);
__decorate([
    Column(DataType.STRING)
], UserConfig.prototype, "timezone", void 0);
__decorate([
    Column(DataType.STRING)
], UserConfig.prototype, "defaultReminderTimeSpan", void 0);
UserConfig = __decorate([
    Table
], UserConfig);
export { UserConfig };
