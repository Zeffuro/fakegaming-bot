export type GuildWithApproximateMemberCount = {
    approximate_member_count?: unknown;
};

export function withDashboardMemberCount<T extends object>(
    guild: T & GuildWithApproximateMemberCount,
): T & { member_count?: number } {
    const memberCount = guild.approximate_member_count;
    return typeof memberCount === "number" && Number.isInteger(memberCount) && memberCount >= 0
        ? { ...guild, member_count: memberCount }
        : guild;
}
