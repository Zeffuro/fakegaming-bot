import {rm} from "node:fs/promises";
import {join} from "node:path";
import {glob} from "glob";

async function main() {
    const paths = await glob("packages/*/dist", {absolute: true});
    if (paths.length === 0) {
        console.log("No dist directories found.");
        return;
    }

    for (const p of paths) {
        await rm(p, {recursive: true, force: true});
        console.log(`Deleted: ${p}`);
    }
}

main().catch((err) => {
    console.error("Error cleaning dist folders:", err);
    process.exit(1);
});
