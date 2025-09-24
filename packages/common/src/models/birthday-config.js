var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Table, Column, Model, DataType, PrimaryKey } from 'sequelize-typescript';
let BirthdayConfig = class BirthdayConfig extends Model {
};
__decorate([
    PrimaryKey,
    Column(DataType.STRING)
], BirthdayConfig.prototype, "userId", void 0);
__decorate([
    Column(DataType.INTEGER)
], BirthdayConfig.prototype, "day", void 0);
__decorate([
    Column(DataType.INTEGER)
], BirthdayConfig.prototype, "month", void 0);
__decorate([
    Column(DataType.INTEGER)
], BirthdayConfig.prototype, "year", void 0);
__decorate([
    Column(DataType.STRING)
], BirthdayConfig.prototype, "guildId", void 0);
__decorate([
    Column(DataType.STRING)
], BirthdayConfig.prototype, "channelId", void 0);
BirthdayConfig = __decorate([
    Table
], BirthdayConfig);
export { BirthdayConfig };
