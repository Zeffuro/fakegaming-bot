import { createHmac } from "node:crypto";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { expectForbidden, expectOk } from "@zeffuro/fakegaming-common/testing";

const auth = vi.hoisted(() => ({ authenticateUser: vi.fn(), isDashboardAdmin: vi.fn() }));
vi.mock("@/lib/auth/authUtils", () => auth);
vi.mock("@/lib/env", () => ({ API_URL: "https://api.test/api", PUBLIC_URL: "https://dashboard.test", SERVICE_API_TOKEN: "service-token", getJwtConfig: () => ({ secret: "test-secret" }) }));
import { POST } from "../../../app/api/auth/twitch/connect/route";
import { GET } from "../../../app/api/auth/twitch/callback/route";
import { TWITCH_STATE_COOKIE, TWITCH_RETURN_COOKIE, twitchReturnPath } from "../twitchOAuth";

const guildId = "123456789012345678";
const state = "opaque-state";
const url = `https://id.twitch.tv/oauth2/authorize?state=${state}`;

function connectRequest(csrf = true) {
    return new NextRequest("https://dashboard.test/api/auth/twitch/connect", {
        method: "POST", body: JSON.stringify({ guildId }),
        headers: { cookie: csrf ? "jwt=jwt-token; csrf=token" : "jwt=jwt-token", ...(csrf ? { "x-csrf-token": "token" } : {}) },
    });
}

function callbackRequest(callbackState = state, storedState = state, returnTo = `/dashboard/twitch/${guildId}`) {
    return new NextRequest(`https://dashboard.test/api/auth/twitch/callback?state=${callbackState}&code=auth-code`, {
        headers: { cookie: `jwt=jwt-token; ${TWITCH_STATE_COOKIE}=${storedState}; ${TWITCH_RETURN_COOKIE}=${returnTo}` },
    });
}

describe("Twitch bot OAuth routes", () => {
    const fetchMock = vi.fn();
    beforeEach(() => {
        auth.authenticateUser.mockResolvedValue({ success: true, user: { discordId: "operator" } });
        auth.isDashboardAdmin.mockReturnValue(true);
        fetchMock.mockResolvedValue(Response.json({ url, state }));
        vi.stubGlobal("fetch", fetchMock);
    });
    afterEach(() => { vi.clearAllMocks(); vi.unstubAllGlobals(); });

    it("rejects connect without CSRF before contacting the backend", async () => {
        expectForbidden(await POST(connectRequest(false)));
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("allows only dashboard operators to connect", async () => {
        auth.isDashboardAdmin.mockReturnValue(false);
        expectForbidden(await POST(connectRequest()));
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("sets scoped HttpOnly state cookies and sends the signed admin identity", async () => {
        const response = await POST(connectRequest());
        expectOk(response);
        expect(await response.json()).toEqual({ url });
        expect(response.cookies.get(TWITCH_STATE_COOKIE)).toMatchObject({ value: state, httpOnly: true, sameSite: "lax", path: "/api/auth/twitch", maxAge: 600 });
        expect(response.cookies.get(TWITCH_RETURN_COOKIE)?.value).toBe(`/dashboard/twitch/${guildId}`);
        const options = fetchMock.mock.calls[0]?.[1] as RequestInit;
        const headers = options.headers as Record<string, string>;
        expect(headers.Authorization).toBe("Bearer jwt-token");
        expect(headers["x-service-token"]).toBe("service-token");
        expect(headers["x-csrf-token"]).toBe("token");
        expect(headers["x-dashboard-admin-signature"]).toBe(createHmac("sha256", "test-secret").update(`operator:${headers["x-dashboard-admin-request"]}`).digest("hex"));
    });

    it("rejects mismatched and missing state and clears OAuth cookies", async () => {
        for (const stored of ["mismatch", ""]) {
            const response = await GET(callbackRequest(state, stored));
            expect(response.headers.get("location")).toBe(`https://dashboard.test/dashboard/twitch/${guildId}?twitchBot=error`);
            expect(response.cookies.get(TWITCH_STATE_COOKIE)?.maxAge).toBe(0);
        }
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("rejects a callback after its operator session expires", async () => {
        auth.authenticateUser.mockResolvedValue({ success: false });
        const response = await GET(callbackRequest());
        expect(response.headers.get("location")).toContain("twitchBot=error");
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("completes the backend flow once and redirects to the fixed guild page", async () => {
        fetchMock.mockResolvedValue(Response.json({ success: true }));
        const response = await GET(callbackRequest());
        expect(fetchMock).toHaveBeenCalledWith("https://api.test/api/twitchClips/bot/complete", expect.objectContaining({ body: JSON.stringify({ code: "auth-code", state }) }));
        expect(response.headers.get("location")).toBe(`https://dashboard.test/dashboard/twitch/${guildId}?twitchBot=success`);
        expect(response.cookies.get(TWITCH_STATE_COOKIE)?.maxAge).toBe(0);
    });

    it("does not accept an external return URL or authorization URL", async () => {
        expect(twitchReturnPath("//evil.test")).toBe("/dashboard/admin/twitch");
        fetchMock.mockResolvedValue(Response.json({ url: "https://evil.test", state }));
        expect((await POST(connectRequest())).ok).toBe(false);
        fetchMock.mockResolvedValue(Response.json({ success: true }));
        expect((await GET(callbackRequest(state, state, "//evil.test"))).headers.get("location")).toBe("https://dashboard.test/dashboard/admin/twitch?twitchBot=success");
    });

    it("converts backend failures to a stable callback result", async () => {
        fetchMock.mockRejectedValue(new Error("provider secret"));
        const response = await GET(callbackRequest());
        expect(response.headers.get("location")).toContain("twitchBot=error");
        expect(response.headers.get("location")).not.toContain("provider");
    });
});
