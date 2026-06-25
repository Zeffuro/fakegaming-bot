import { describe, expect, it } from "vitest";
import { getAdminJobRunDetails } from "@/lib/adminJobRunDetails";
import type { JobRunEntry } from "@/lib/api/jobs";

function run(partial: Partial<JobRunEntry>): JobRunEntry {
    return {
        startedAt: "2026-06-25T10:00:00.000Z",
        finishedAt: "2026-06-25T10:00:01.000Z",
        ok: true,
        ...partial,
    };
}

describe("admin job run details", () => {
    it("formats Twitch poll metadata with VOD scheduling counts", () => {
        expect(getAdminJobRunDetails(run({
            meta: {
                processed: 2,
                errors: 1,
                vodFollowupsScheduled: 3,
                vodFollowupScheduleErrors: 1,
            },
        }), "twitch")).toBe("processed: 2, errors: 1, VOD scheduled: 3, VOD schedule errors: 1");
    });

    it("formats Twitch VOD follow-up outcome metadata", () => {
        expect(getAdminJobRunDetails(run({
            meta: {
                job: "vod-followup",
                status: "no_archive_video",
                username: "creator",
            },
        }), "twitch")).toBe("VOD follow-up: no archive yet: @creator");
    });

    it("keeps existing birthday and heartbeat summaries", () => {
        expect(getAdminJobRunDetails(run({ meta: { processed: 4, force: true } }), "birthdays")).toBe("processed: 4 (force)");
        expect(getAdminJobRunDetails(run({ meta: { backend: "redis" } }), "heartbeat")).toBe("backend: redis");
    });
});
