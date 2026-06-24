import { describe, expect, it } from "vitest";
import { buildAdminJobRetryPayload, canRetryAdminJobRun } from "@/lib/adminJobRetry";
import type { JobRunEntry } from "@/lib/api/jobs";

function run(partial: Partial<JobRunEntry>): JobRunEntry {
    return {
        startedAt: "2026-06-24T08:00:00.000Z",
        finishedAt: "2026-06-24T08:01:00.000Z",
        ok: false,
        ...partial,
    };
}

describe("admin job retry helpers", () => {
    it("allows retrying failed runs only", () => {
        expect(canRetryAdminJobRun(run({ ok: false }))).toBe(true);
        expect(canRetryAdminJobRun(run({ ok: true }))).toBe(false);
    });

    it("reuses supported date and force values from failed run metadata", () => {
        expect(buildAdminJobRetryPayload(
            { supportsDate: true, supportsForce: true },
            run({ meta: { date: "2026-06-24T09:15:00.000Z", force: true } }),
        )).toEqual({
            date: "2026-06-24T09:15:00.000Z",
            force: true,
        });
    });

    it("omits unsupported retry fields", () => {
        expect(buildAdminJobRetryPayload(
            { supportsDate: false, supportsForce: false },
            run({ meta: { date: "2026-06-24T09:15:00.000Z", force: true } }),
        )).toEqual({});
    });

    it("ignores invalid dates and false force values", () => {
        expect(buildAdminJobRetryPayload(
            { supportsDate: true, supportsForce: true },
            run({ meta: { date: "not-a-date", force: false } }),
        )).toEqual({});
    });
});
