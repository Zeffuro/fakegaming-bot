import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatDashboardMessage } from "@/lib/i18n/messages";
import type { DashboardTranslator } from "@/lib/i18n/messages";
import type { TwitchClipConfig } from "@/lib/api/twitchClips";

const mocks = vi.hoisted(() => ({
    guild: { id: "123456789012345678" },
    admin: false,
    locale: "en" as "en" | "nl",
    list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn(), status: vi.fn(), connect: vi.fn(), disconnect: vi.fn(),
}));
vi.mock("@/components/hooks/useGuildFromParams", () => ({ useGuildFromParams: () => ({ guildId: mocks.guild.id, guild: mocks.guild }) }));
vi.mock("@/components/hooks/useGuildChannels", () => ({ useGuildChannels: () => ({ channels: [{ id: "456", name: "clips", type: 0 }], error: null, getChannelName: () => "#clips" }) }));
vi.mock("@/components/hooks/useAdmin", () => ({ useAdminAccess: () => ({ isAdmin: mocks.admin }) }));
vi.mock("@/lib/api/twitchClips", () => ({ twitchClipsApi: mocks }));
vi.mock("@/components/i18n/DashboardI18nProvider", () => ({ useDashboardI18n: () => ({ t: translate }) }));
const translate: DashboardTranslator = (key, values) => formatDashboardMessage(mocks.locale, key, values);
import { TwitchClipSettings } from "../TwitchClipSettings";

const config: TwitchClipConfig = {
    id: "uuid", broadcasterId: "789", guildId: "123456789012345678", twitchUsername: "streamer",
    discordChannelId: "456", command: "!clip", aliases: ["!c"], permission: "moderators", cooldownSeconds: 30, durationSeconds: 30, enabled: false,
    replyEnabled: true, replyTemplate: "Thanks {user}: {url}",
};

describe("Twitch clip dashboard settings", () => {
    let root: ReturnType<typeof createRoot>;
    let container: HTMLDivElement;
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.admin = false;
        mocks.locale = "en";
        mocks.list.mockResolvedValue([config]);
        mocks.status.mockResolvedValue({ configured: true, connected: true, login: "clipbot", jobsEnabled: true, chatConnected: true, subscribedChannels: 1, lastErrorCode: null });
        container = document.createElement("div");
        document.body.append(container);
        root = createRoot(container);
    });
    afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
    const render = async () => { await act(async () => root.render(<TwitchClipSettings />)); };
    const click = async (key: Parameters<typeof translate>[0]) => {
        const buttons = [...document.body.querySelectorAll("button")].filter(element => element.textContent === translate(key));
        const button = buttons.at(-1);
        expect(button).toBeDefined();
        await act(async () => button?.click());
    };
    const setField = async (key: Parameters<typeof translate>[0], value: string) => {
        const label = [...document.body.querySelectorAll("label")].find(element => element.textContent === translate(key));
        const input = document.body.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[id="${label?.htmlFor}"]`);
        expect(input).not.toBeNull();
        await act(async () => {
            const prototype = input?.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
            Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(input, value);
            input?.dispatchEvent(new Event("input", { bubbles: true }));
        });
    };

    it("shows channel configuration and safe bot status without operator connection controls", async () => {
        await render();
        expect(container.textContent).toContain("streamer");
        expect(container.textContent).toContain("#clips");
        expect(container.textContent).toContain(translate("clips.operatorHelp"));
        expect(container.textContent).not.toContain(translate("clips.connect"));
        expect(container.querySelector<HTMLInputElement>('input[value="!clip"]')).toBeNull();
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
        expect(mocks.update).toHaveBeenCalledWith("uuid", expect.objectContaining({ aliases: ["!c"], permission: "moderators", durationSeconds: 30, guildId: config.guildId, replyEnabled: true, replyTemplate: config.replyTemplate }));
        expect(mocks.update.mock.calls[0]?.[1]).not.toHaveProperty("id");
        expect(mocks.update.mock.calls[0]?.[1]).not.toHaveProperty("broadcasterId");
    });

    it("validates an incomplete form without sending a request", async () => {
        await render();
        await click("clips.add");
        await click("clips.add");
        expect(document.body.textContent).toContain(translate("clips.invalid"));
        expect(mocks.create).not.toHaveBeenCalled();
    });

    it("saves changed aliases and duration while preserving the paused channel", async () => {
        await render();
        await click("clips.edit");
        for (const [key, value] of [["clips.aliases", "!moment, !highlight"], ["clips.duration", "45"]] as const) {
            await setField(key, value);
        }
        await click("clips.save");
        expect(mocks.update).toHaveBeenCalledWith("uuid", expect.objectContaining({ aliases: ["!moment", "!highlight"], durationSeconds: 45, enabled: false }));
    });

    it("keeps the edit form available when Twitch rejects a save", async () => {
        mocks.update.mockRejectedValueOnce(new Error("Twitch unavailable"));
        await render();
        await click("clips.edit");
        await click("clips.save");
        expect(document.body.textContent).toContain("Twitch unavailable");
        expect(document.body.textContent).toContain(translate("clips.editTitle"));
        const saveButton = [...document.body.querySelectorAll("button")].find(element => element.textContent === translate("clips.save"));
        expect(saveButton?.disabled).toBe(false);
    });

    it("shows connection controls only to dashboard operators", async () => {
        mocks.admin = true;
        await render();
        expect(container.textContent).toContain(translate("clips.connect"));
        await click("clips.disconnect");
        expect(mocks.disconnect).toHaveBeenCalledOnce();
    });

    it.each(["en", "nl"] as const)("adds default replies and edits custom replies in %s", async locale => {
        mocks.locale = locale;
        await render();
        await click("clips.add");
        expect(document.body.textContent).toContain(translate("clips.replyLocaleHelp"));
        expect(document.body.textContent).toContain(translate("clips.commandHelp", { command: "!clip" }));
        expect(document.body.textContent).toContain("{url}");
        await setField("clips.username", "newstreamer");
        const destination = [...document.body.querySelectorAll('[role="combobox"]')][0];
        await act(async () => destination?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true })));
        const option = [...document.body.querySelectorAll('[role="option"]')].find(element => element.textContent === "#clips");
        await act(async () => (option as HTMLElement | undefined)?.click());
        await click("clips.add");
        expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ twitchUsername: "newstreamer", replyEnabled: true, replyTemplate: null }));
        await click("clips.edit");
        await setField("clips.command", "!moment");
        expect(document.body.textContent).toContain(translate("clips.commandHelp", { command: "!moment" }));
        await setField("clips.replyTemplate", "  Custom {url} for {user} in {channel}  ");
        const replyToggle = [...document.body.querySelectorAll("label")].find(element => element.textContent === translate("clips.replyEnabled"))?.querySelector<HTMLInputElement>('input[type="checkbox"]');
        expect(replyToggle).not.toBeNull();
        await act(async () => replyToggle?.click());
        await click("clips.save");
        expect(mocks.update).toHaveBeenCalledWith("uuid", expect.objectContaining({ replyEnabled: false, replyTemplate: "  Custom {url} for {user} in {channel}  " }));
    });

    it("stores blank templates as null and preserves disabled replies", async () => {
        mocks.list.mockResolvedValue([{ ...config, replyEnabled: false }]);
        await render();
        await click("clips.edit");
        const template = document.body.querySelector<HTMLTextAreaElement>("textarea");
        expect(template?.disabled).toBe(true);
        await click("clips.save");
        expect(mocks.update).toHaveBeenCalledWith("uuid", expect.objectContaining({ replyEnabled: false, replyTemplate: config.replyTemplate }));
        mocks.list.mockResolvedValue([{ ...config, replyTemplate: "   " }]);
        await click("clips.edit");
        await setField("clips.replyTemplate", "   ");
        await click("clips.save");
        expect(mocks.update).toHaveBeenLastCalledWith("uuid", expect.objectContaining({ replyTemplate: null }));
    });

    it("rejects oversized templates without sending a save", async () => {
        await render();
        await click("clips.edit");
        await setField("clips.replyTemplate", "a".repeat(401));
        await click("clips.save");
        expect(document.body.textContent).toContain(translate("clips.replyTooLong"));
        expect(mocks.update).not.toHaveBeenCalled();
    });

    it.each(["en", "nl"] as const)("shows old-token authorization guidance and operator action in %s", async locale => {
        mocks.locale = locale;
        mocks.admin = true;
        mocks.status.mockResolvedValue({ configured: true, connected: true, login: "clipbot", jobsEnabled: true, chatConnected: true, chatReplyAuthorized: false, subscribedChannels: 1 });
        await render();
        expect(container.textContent).toContain(translate("clips.replyReconnect"));
        expect(container.textContent).toContain(translate("clips.reconnect"));
        expect(container.textContent).toContain("user:write:chat");
    });

    it("does not prompt to reconnect when reply authorization status is unknown", async () => {
        await render();
        expect(container.textContent).not.toContain(translate("clips.replyReconnect"));
    });

    it("shows old-token guidance to guild administrators without connection controls", async () => {
        mocks.status.mockResolvedValue({ configured: true, connected: true, jobsEnabled: true, chatReplyAuthorized: false, lastErrorCode: "chat_reply_authorization_required" });
        await render();
        expect(container.textContent?.split(translate("clips.replyReconnect"))).toHaveLength(2);
        expect(container.textContent).toContain(translate("clips.operatorHelp"));
        expect(container.textContent).not.toContain(translate("clips.reconnect"));
    });
});
