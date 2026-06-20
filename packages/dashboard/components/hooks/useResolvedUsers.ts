import { useCallback, useState } from "react";
import { api } from "@/lib/api-client";

export interface ResolvedUser {
    id: string;
    username?: string;
    global_name?: string | null;
    discriminator?: string | null;
    avatar?: string | null;
    nickname?: string | null;
}

interface UseResolvedUsersOptions {
    warningMessage?: string;
}

export function useResolvedUsers(guildId: string, options: UseResolvedUsersOptions = {}) {
    const [userMap, setUserMap] = useState<Record<string, ResolvedUser>>({});
    const warningMessage = options.warningMessage ?? "Failed to resolve users";

    const resolveUsers = useCallback(async (ids: string[]) => {
        const unique = Array.from(new Set(ids.filter(Boolean)));
        if (!guildId || unique.length === 0) return;

        try {
            const map: Record<string, ResolvedUser> = {};
            for (let i = 0; i < unique.length; i += 50) {
                const result = await api.resolveUsers(guildId, unique.slice(i, i + 50));
                for (const user of result.users) {
                    map[user.id] = user as ResolvedUser;
                }
            }
            setUserMap(prev => ({ ...prev, ...map }));
        } catch (error) {
            console.warn(warningMessage, error);
        }
    }, [guildId, warningMessage]);

    return {
        userMap,
        resolveUsers,
    };
}
