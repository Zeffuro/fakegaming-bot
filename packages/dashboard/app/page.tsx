"use client";
import React, {useEffect, useState} from "react";

export default function Home() {
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function handleOAuth() {
            setLoading(true);
            const url = new URL(window.location.href);
            const isCallback = url.pathname === "/api/auth/discord/callback" && url.searchParams.get("code");
            if (isCallback) {
                // After login, redirect to dashboard (cookie is set by backend)
                window.location.href = "/dashboard";
                return;
            }
            setLoading(false);
        }

        handleOAuth();
    }, []);

    const login = () => {
        window.location.href = "/api/auth/discord";
    };

    if (loading) return <div>Loading...</div>;

    return (
        <main style={{padding: 32, maxWidth: 400, margin: "0 auto", textAlign: "center"}}>
            <h1>Fakegaming Bot Dashboard</h1>
            <p>Log in with Discord to manage your servers and bot settings.</p>
            <button onClick={login} style={{
                marginTop: 24,
                padding: "12px 24px",
                fontSize: 18,
                borderRadius: 8,
                background: "#5865F2",
                color: "#fff",
                border: "none",
                cursor: "pointer"
            }}>Login with Discord
            </button>
        </main>
    );
}
