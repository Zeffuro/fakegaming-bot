import { describe, expect, it } from "vitest";
import { buildAdminAuditMetadataView } from "@/lib/adminAuditDetail";

describe("admin audit detail helpers", () => {
    it("returns an empty metadata view when no metadata exists", () => {
        expect(buildAdminAuditMetadataView(null)).toEqual({
            hasMetadata: false,
            keyCount: 0,
            keys: [],
            summary: "No metadata",
            formatted: "No metadata recorded for this event.",
        });
    });

    it("summarizes sorted metadata keys and caps summary length", () => {
        const view = buildAdminAuditMetadataView({
            zebra: true,
            alpha: "one",
            middle: 2,
            beta: "two",
            omega: "last",
        });

        expect(view).toMatchObject({
            hasMetadata: true,
            keyCount: 5,
            keys: ["alpha", "beta", "middle", "omega", "zebra"],
            summary: "5 metadata keys: alpha, beta, middle, omega, +1 more",
        });
    });

    it("redacts sensitive-looking keys before formatting", () => {
        const view = buildAdminAuditMetadataView({
            token: "secret",
            nested: {
                sessionCookie: "cookie",
                visible: "safe",
            },
        });

        expect(view.formatted).toContain('"token": "[redacted]"');
        expect(view.formatted).toContain('"sessionCookie": "[redacted]"');
        expect(view.formatted).toContain('"visible": "safe"');
        expect(view.formatted).not.toContain("secret");
        expect(view.formatted).not.toContain("cookie");
    });
});
