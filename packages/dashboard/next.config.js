import path from "path";
import {fileURLToPath} from "node:url";

const traceRoot = path.join(fileURLToPath(import.meta.url), '../..');

const nextConfig = {
    outputFileTracingRoot: traceRoot,
    output: 'standalone',
};

export default nextConfig;