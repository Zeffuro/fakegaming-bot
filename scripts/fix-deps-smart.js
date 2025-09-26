import {execSync} from "child_process";
import fs from "fs";
import path from "path";
import depcheck from "depcheck";

const ROOT = process.cwd();
const PACKAGES_DIR = path.join(ROOT, "packages");

function safeExec(cmd) {
    try {
        execSync(cmd, {stdio: "inherit"});
    } catch (e) {
        console.log(`Skipping command (probably path doesn't exist or invalid): ${cmd}`);
    }
}

function getPackages() {
    return fs.readdirSync(PACKAGES_DIR)
        .map(name => path.join(PACKAGES_DIR, name))
        .filter(p => fs.statSync(p).isDirectory() && fs.existsSync(path.join(p, "package.json")));
}

const options = {ignoreBinPackage: false, ignoreDirs: ["dist", "build", "node_modules"], skipMissing: false};

async function main() {
    console.log("Cleaning package node_modules...");
    // Windows-safe rimraf per package
    for (const pkg of getPackages()) {
        const nm = path.join(pkg, "node_modules");
        safeExec(`rimraf "${nm}"`);
    }

    for (const pkgPath of getPackages()) {
        const pkgName = path.basename(pkgPath);
        console.log(`\nChecking dependencies for ${pkgName}...`);

        const pkgJsonPath = path.join(pkgPath, "package.json");
        const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, "utf-8"));

        const result = await depcheck(pkgPath, options);

        // Remove unused dependencies (run in package folder using --filter)
        const unusedDeps = result.dependencies.concat(result.devDependencies);
        if (unusedDeps.length) {
            console.log(`Removing unused deps from ${pkgName}: ${unusedDeps.join(", ")}`);
            safeExec(`pnpm remove ${unusedDeps.join(" ")} -F ${pkgName}`);
        }

        // Add missing dependencies
        const missingDeps = Object.keys(result.missing);
        if (missingDeps.length) {
            console.log(`Adding missing deps to ${pkgName}: ${missingDeps.join(", ")}`);
            safeExec(`pnpm add ${missingDeps.join(" ")} -F ${pkgName}`);
        }
    }

    console.log("\nReinstalling all packages cleanly...");
    safeExec("pnpm install");

    console.log("✅ Dependencies fixed!");
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
