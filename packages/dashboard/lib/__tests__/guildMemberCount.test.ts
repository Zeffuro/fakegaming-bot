import { describe, expect, it } from "vitest";
import { withDashboardMemberCount } from "@/lib/guildMemberCount";

describe("withDashboardMemberCount", () => {
    it("maps Discord's approximate count to the dashboard contract", () => {
        expect(withDashboardMemberCount({ id: "guild", approximate_member_count: 42 })).toEqual({
            id: "guild",
            approximate_member_count: 42,
            member_count: 42,
        });
    });

    it("preserves zero and ignores invalid or absent counts", () => {
        expect(withDashboardMemberCount({ id: "empty", approximate_member_count: 0 }).member_count).toBe(0);
        expect(withDashboardMemberCount({ id: "invalid", approximate_member_count: -1 })).not.toHaveProperty("member_count");
        expect(withDashboardMemberCount({ id: "missing" })).not.toHaveProperty("member_count");
    });
});
