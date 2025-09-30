"use client";
import React, {useEffect, useState} from "react";
import Container from "@mui/material/Container";
import LoginCard from "@/components/LoginCard";

export default function Home() {
    const [isLoggedIn, setIsLoggedIn] = useState(false);

    useEffect(() => {
        fetch("/api/auth/me", {method: "PUT", credentials: "include"})
            .then(res => res.ok ? res.json() : Promise.reject())
            .then(data => {
                if (data.user) setIsLoggedIn(true);
            })
            .catch(() => setIsLoggedIn(false));
    }, []);

    return (
        <Container maxWidth="xs" sx={{minHeight: "100vh", display: "flex", alignItems: "center"}}>
            <LoginCard isLoggedIn={isLoggedIn}/>
        </Container>
    );
}