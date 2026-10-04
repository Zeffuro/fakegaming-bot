import { beforeEach, describe, expect, it, vi } from "vitest";
const request = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/core", () => ({ apiRequest: request }));
import { twitchClipsApi } from "../api/twitchClips";

describe("Twitch clips client", () => {
    beforeEach(() => request.mockReset());
    it("keeps guild-scoped clip configuration separate from stream notifications", async () => {
        await twitchClipsApi.list("123");
        expect(request).toHaveBeenCalledWith("/api/external/twitchClips?guildId=123");
        await twitchClipsApi.update("config/id", { enabled: false });
        expect(request).toHaveBeenCalledWith("/api/external/twitchClips/config%2Fid", { method: "PUT", body: { enabled: false } });
    });
    it("initiates OAuth through the state-cookie route", async () => {
        await twitchClipsApi.connect("123");
        expect(request).toHaveBeenCalledWith("/api/auth/twitch/connect", { method: "POST", body: { guildId: "123" } });
        await twitchClipsApi.disconnect();
        expect(request).toHaveBeenCalledWith("/api/external/twitchClips/bot", { method: "DELETE" });
    });
});
