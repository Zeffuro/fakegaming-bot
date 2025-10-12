"use client";
import { useParams } from "next/navigation";
import { useDashboardData } from "@/components/hooks/useDashboardData";

export interface UseGuildFromParamsResult<TGuild = any> {
    guildId: string;
    guild: TGuild | undefined;
    guildsLoading: boolean;
}

/**
 * Returns the current guildId from the route, the matching guild object, and whether guilds are still loading.
 */
export function useGuildFromParams<TGuild = any>(): UseGuildFromParamsResult<TGuild> {
    const { guildId } = useParams();
    const { guilds, loading } = useDashboardData();
    const guild = guilds.find(g => g.id === (guildId as string)) as TGuild | undefined;
    return { guildId: guildId as string, guild, guildsLoading: loading };
}

