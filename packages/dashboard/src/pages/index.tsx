import {useSession, signIn, signOut} from "next-auth/react";

export default function Home() {
    const {data: session, status} = useSession();

    if (status === "loading") {
        return <div>Loading...</div>;
    }

    return (
        <main style={{padding: 32}}>
            <h1>Fakegaming Bot Dashboard</h1>
            {!session ? (
                <>
                    <p>You are not logged in.</p>
                    <button onClick={() => signIn("discord")}>Login with Discord</button>
                </>
            ) : (
                <>
                    <p>Welcome, {session.user?.name}!</p>
                    <img src={session.user?.image ?? ""} alt="avatar" style={{width: 64, borderRadius: "50%"}}/>
                    <pre>{JSON.stringify(session.user, null, 2)}</pre>
                    <button onClick={() => signOut()}>Logout</button>
                </>
            )}
        </main>
    );
}

