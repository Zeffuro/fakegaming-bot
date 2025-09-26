import NextAuth from "next-auth";
import DiscordProvider from "next-auth/providers/discord";

export default NextAuth({
    providers: [
        (DiscordProvider as unknown as (...args: any[]) => any)({
            clientId: process.env.DISCORD_CLIENT_ID!,
            clientSecret: process.env.DISCORD_CLIENT_SECRET!,
            authorization: {params: {scope: "identify guilds"}},
        }),
    ],
    callbacks: {
        async session({session, token}: { session: any; token: any }) {
            // Add Discord user ID and access token to session
            if (token.sub) (session.user as any).id = token.sub;
            if (token.accessToken) (session as any).accessToken = token.accessToken;

            // Fetch guilds and check admin status
            if (token.accessToken) {
                try {
                    const res = await fetch("https://discord.com/api/users/@me/guilds", {
                        headers: {Authorization: `Bearer ${token.accessToken}`},
                    });
                    if (res.ok) {
                        const guilds: Array<{ id: string; permissions: number }> = await res.json();
                        // Specify your required guild IDs here
                        const requiredGuildIds: string[] = [/* add your required guild IDs here */];
                        (session as any).isAdmin = Array.isArray(guilds) && guilds.some((guild: {
                                id: string;
                                permissions: number
                            }) =>
                                requiredGuildIds.includes(guild.id) &&
                                (guild.permissions & (0x8 | 0x20)) // ADMINISTRATOR or MANAGE_GUILD
                        );
                        (session as any).guilds = guilds;
                    }
                } catch {
                    (session as any).isAdmin = false;
                }
            }
            return session;
        },
        async jwt({token, account}: { token: any; account?: any }) {
            // Persist access token in JWT
            if (account?.access_token) {
                token.accessToken = account.access_token;
            }
            return token;
        },
    },
});
