var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Table, Column, Model, DataType, PrimaryKey } from 'sequelize-typescript';
let ReminderConfig = class ReminderConfig extends Model {
};
__decorate([
    PrimaryKey,
    Column(DataType.STRING)
], ReminderConfig.prototype, "id", void 0);
__decorate([
    Column(DataType.STRING)
], ReminderConfig.prototype, "userId", void 0);
__decorate([
    Column(DataType.TEXT)
], ReminderConfig.prototype, "message", void 0);
__decorate([
    Column(DataType.STRING)
], ReminderConfig.prototype, "timespan", void 0);
__decorate([
    Column(DataType.BIGINT)
], ReminderConfig.prototype, "timestamp", void 0);
__decorate([
    Column(DataType.BOOLEAN)
], ReminderConfig.prototype, "completed", void 0);
ReminderConfig = __decorate([
    Table
], ReminderConfig);
export { ReminderConfig };
