import path from "path";
import {fileURLToPath} from "node:url";

const traceRoot = path.join(fileURLToPath(import.meta.url), '../..');

const nextConfig = {
    outputFileTracingRoot: traceRoot,
    output: 'standalone',

    // Add webpack configuration to suppress specific warnings
    webpack: (config, { isServer }) => {
        // Ignore warnings about critical dependencies in sequelize and related modules
        config.ignoreWarnings = [
            // Ignore warnings from sequelize and related modules
            {
                module: /node_modules\/@rushstack\/node-core-library/,
                message: /Critical dependency/
            },
            {
                module: /node_modules\/sequelize-typescript/,
                message: /Critical dependency/
            },
            {
                module: /node_modules\/umzug/,
                message: /Critical dependency/
            },
            {
                module: /node_modules\/sequelize/,
                message: /Critical dependency/
            }
        ];

        return config;
    },
};

export default nextConfig;