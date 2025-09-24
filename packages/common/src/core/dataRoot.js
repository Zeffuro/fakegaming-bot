import path from "path";
import { PROJECT_ROOT } from "./projectRoot.js";
export function resolveDataRoot() {
    const rawDataRoot = process.env.DATA_ROOT || "data";
    return path.resolve(PROJECT_ROOT, rawDataRoot);
}
