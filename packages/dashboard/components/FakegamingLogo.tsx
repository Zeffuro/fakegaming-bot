import BaseAvatar from "./BaseAvatar";
import Image from "next/image";

export default function FakegamingLogo({
    size = 120,
    variant = "circle",
    elevation = 3,
}: { size?: number; variant?: "circle" | "square"; elevation?: number }) {
    return (
        <BaseAvatar
            size={size}
            variant={variant}
            elevation={elevation}
            bgcolor="background.paper"
        >
            <Image
                src="/icons/logo.webp"
                alt="Fakegaming Logo"
                width={size}
                height={size}
                style={{objectFit: "cover"}}
                priority
            />
        </BaseAvatar>
    );
}