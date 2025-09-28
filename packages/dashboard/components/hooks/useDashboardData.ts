import {useEffect, useState} from "react";

export function useDashboardData() {
    const [user, setUser] = useState<any>(null);
    const [guilds, setGuilds] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);

    useEffect(() => {
        async function fetchData() {
            setLoading(true);
            const userRes = await fetch("/api/auth/me", {method: "PUT"});
            if (userRes.ok) {
                const userData = await userRes.json();
                setUser(userData.user);
                const guildRes = await fetch("/api/guilds");
                if (guildRes.ok) {
                    const guildData = await guildRes.json();
                    setGuilds(guildData.guilds);
                    setIsAdmin(guildData.isAdmin);
                }
            } else {
                window.location.href = "/";
                return;
            }
            setLoading(false);
        }

        fetchData();
    }, []);

    return {user, guilds, loading, isAdmin};
}