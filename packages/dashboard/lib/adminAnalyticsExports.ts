import type { AuditEventEntry } from "@/lib/api/audit";
import type { IntegrationHealthRecord, JobRunEntry } from "@/lib/api-client";
import type { CsvRow } from "@/lib/csvExport";

export const adminAuditCsvHeaders = [
    "id",
    "timestamp",
    "actorType",
    "actorId",
    "action",
    "targetType",
    "targetId",
    "guildId",
    "severity",
    "status",
    "requestId",
    "metadata",
] as const;

export const adminIntegrationHealthCsvHeaders = [
    "provider",
    "configId",
    "guildId",
    "channelId",
    "status",
    "consecutiveFailures",
    "lastCheckedAt",
    "lastSuccessAt",
    "lastFailureAt",
    "lastDeliveryAt",
    "lastErrorCode",
    "lastErrorMessage",
    "metadata",
] as const;

export const adminJobRunsCsvHeaders = [
    "job",
    "result",
    "startedAt",
    "finishedAt",
    "error",
    "metadata",
] as const;

export function buildAdminAuditCsvRows(events: readonly AuditEventEntry[]): CsvRow[] {
    return events.map((event) => [
        event.id,
        event.timestamp,
        event.actorType,
        event.actorId,
        event.action,
        event.targetType,
        event.targetId,
        event.guildId,
        event.severity,
        event.status,
        event.requestId,
        stringifyCsvObject(event.metadata),
    ]);
}

export function buildAdminIntegrationHealthCsvRows(records: readonly IntegrationHealthRecord[]): CsvRow[] {
    return records.map((record) => [
        record.provider,
        record.configId,
        record.guildId,
        record.channelId,
        record.status,
        record.consecutiveFailures,
        record.lastCheckedAt,
        record.lastSuccessAt,
        record.lastFailureAt,
        record.lastDeliveryAt,
        record.lastErrorCode,
        record.lastErrorMessage,
        stringifyCsvObject(record.metadata),
    ]);
}

export function buildAdminJobRunCsvRows(jobName: string, runs: readonly JobRunEntry[]): CsvRow[] {
    return runs.map((run) => [
        jobName,
        run.ok ? "success" : "failure",
        run.startedAt,
        run.finishedAt,
        run.error,
        stringifyCsvObject(run.meta),
    ]);
}

function stringifyCsvObject(value: Record<string, unknown> | null | undefined): string {
    if (!value) return "";
    return JSON.stringify(value);
}
