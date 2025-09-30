"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function DiscordCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");
    if (!code) {
      router.replace("/");
      return;
    }
    // Exchange code for JWT
    fetch("/api/auth/discord/callback/api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code })
    })
      .then(res => res.json())
      .then(data => {
        if (data.token) {
          // Set cookie via POST, then redirect
          fetch("/api/auth/set-cookie", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: data.token })
          })
            .then(() => router.replace("/dashboard"))
            .catch(() => router.replace("/"));
        } else {
          router.replace("/");
        }
      })
      .catch(() => router.replace("/"));
  }, [router]);

  return <div>Logging in with Discord...</div>;
}
