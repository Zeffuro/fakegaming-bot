import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatDashboardMessage } from "@/lib/i18n/messages";
import type { DashboardTranslator } from "@/lib/i18n/messages";
import type { TwitchClipConfig } from "@/lib/api/twitchClips";

const mocks = vi.hoisted(() => ({
    guild: { id: "123456789012345678" },
    admin: false,
    list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn(), status: vi.fn(), connect: vi.fn(), disconnect: vi.fn(),
}));
vi.mock("@/components/hooks/useGuildFromParams", () => ({ useGuildFromParams: () => ({ guildId: mocks.guild.id, guild: mocks.guild }) }));
vi.mock("@/components/hooks/useGuildChannels", () => ({ useGuildChannels: () => ({ channels: [{ id: "456", name: "clips", type: 0 }], error: null, getChannelName: () => "#clips" }) }));
vi.mock("@/components/hooks/useAdmin", () => ({ useAdminAccess: () => ({ isAdmin: mocks.admin }) }));
vi.mock("@/lib/api/twitchClips", () => ({ twitchClipsApi: mocks }));
vi.mock("@/components/i18n/DashboardI18nProvider", () => ({ useDashboardI18n: () => ({ t: translate }) }));
const translate: DashboardTranslator = (key, values) => formatDashboardMessage("en", key, values);
import { TwitchClipSettings } from "../TwitchClipSettings";

const config: TwitchClipConfig = {
    id: "uuid", broadcasterId: "789", guildId: "123456789012345678", twitchUsername: "streamer",
    discordChannelId: "456", command: "!clip", aliases: ["!c"], permission: "moderators", cooldownSeconds: 30, durationSeconds: 30, enabled: false,
};

describe("Twitch clip dashboard settings", () => {
    let root: ReturnType<typeof createRoot>;
    let container: HTMLDivElement;
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.admin = false;
        mocks.list.mockResolvedValue([config]);
        mocks.status.mockResolvedValue({ configured: true, connected: true, login: "clipbot", jobsEnabled: true, chatConnected: true, subscribedChannels: 1, lastErrorCode: null });
        container = document.createElement("div");
        document.body.append(container);
        root = createRoot(container);
    });
    afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
    const render = async () => { await act(async () => root.render(<TwitchClipSettings />)); };
    const click = async (key: Parameters<typeof translate>[0]) => {
        const button = [...container.querySelectorAll("button")].find(element => element.textContent === translate(key));
        expect(button).toBeDefined();
        await act(async () => button?.click());
    };

    it("shows channel configuration and safe bot status without operator connection controls", async () => {
        await render();
        expect(container.textContent).toContain("streamer");
        expect(container.textContent).toContain("#clips");
        expect(container.textContent).toContain(translate("clips.operatorHelp"));
        expect(container.textContent).not.toContain(translate("clips.connect"));
        expect(container.querySelector<HTMLInputElement>('input[value="!clip"]')).not.toBeNull();
    });

    it("lets guild administrators resume and delete a channel", async () => {
        await render();
        await click("clips.resume");
        expect(mocks.update).toHaveBeenCalledWith("uuid", { enabled: true });
        await click("clips.delete");
        expect(mocks.remove).toHaveBeenCalledWith("uuid");
    });

    it("preserves aliases, permissions and duration when editing", async () => {
        await render();
        await click("clips.edit");
        await click("clips.save");
        expect(mocks.update).toHaveBeenCalledWith("uuid", expect.objectContaining({ aliases: ["!c"], permission: "moderators", durationSeconds: 30, guildId: config.guildId }));
        expect(mocks.update.mock.calls[0]?.[1]).not.toHaveProperty("id");
        expect(mocks.update.mock.calls[0]?.[1]).not.toHaveProperty("broadcasterId");
    });

    it("validates an incomplete form without sending a request", async () => {
        await render();
        await click("clips.add");
        expect(container.textContent).toContain(translate("clips.invalid"));
        expect(mocks.create).not.toHaveBeenCalled();
    });

    it("saves changed aliases and duration while preserving the paused channel", async () => {
        await render();
        await click("clips.edit");
        for (const [key, value] of [["clips.aliases", "!moment, !highlight"], ["clips.duration", "45"]] as const) {
            const label = [...container.querySelectorAll("label")].find(element => element.textContent === translate(key));
            const input = container.querySelector<HTMLInputElement>(`input[id="${label?.htmlFor}"]`);
            expect(input).not.toBeNull();
            await act(async () => {
                Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
                input?.dispatchEvent(new Event("input", { bubbles: true }));
            });
        }
        await click("clips.save");
        expect(mocks.update).toHaveBeenCalledWith("uuid", expect.objectContaining({ aliases: ["!moment", "!highlight"], durationSeconds: 45, enabled: false }));
    });

    it("keeps the edit form available when Twitch rejects a save", async () => {
        mocks.update.mockRejectedValueOnce(new Error("Twitch unavailable"));
        await render();
        await click("clips.edit");
        await click("clips.save");
        expect(container.textContent).toContain("Twitch unavailable");
        expect(container.textContent).toContain(translate("clips.editTitle"));
        const saveButton = [...container.querySelectorAll("button")].find(element => element.textContent === translate("clips.save"));
        expect(saveButton?.disabled).toBe(false);
    });

    it("shows connection controls only to dashboard operators", async () => {
        mocks.admin = true;
        await render();
        expect(container.textContent).toContain(translate("clips.connect"));
        await click("clips.disconnect");
        expect(mocks.disconnect).toHaveBeenCalledOnce();
    });
});
