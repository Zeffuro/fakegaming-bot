import path from "path";
import {homedir} from "node:os";
import {fileURLToPath} from "node:url";

if (process.platform === 'win32' && !process.env.SWC_NATIVE_BINDING_CACHE) {
    // AppData can inherit capability ACLs that SWC rejects for its native cache.
    process.env.SWC_NATIVE_BINDING_CACHE = path.join(homedir(), '.swc-cache');
}

const {default: createNextIntlPlugin} = await import('next-intl/plugin');

// Compute the trace root from the directory containing this config file
const traceRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');

const nextConfig = {
    outputFileTracingRoot: traceRoot,
    output: 'standalone',

    // Avoid bundling pino and its worker-based deps; load them from Node instead
    serverExternalPackages: [
        'pino',
        'pino-pretty',
        'thread-stream',
        'sonic-boom'
    ],

    // Add turbopack configuration for Next.js 16
    turbopack: {},

    // Add webpack configuration to suppress specific warnings
    webpack: (config) => {
        // Ensure .js imports can resolve to TypeScript sources when present
        config.resolve = config.resolve || {};
        config.resolve.extensionAlias = {
            // Prefer TypeScript when importing .js from TS code, but allow .js fallback
            '.js': ['.ts', '.tsx', '.js'],
            '.mjs': ['.mts', '.mjs'],
            '.cjs': ['.cts', '.cjs'],
        };

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

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

export default withNextIntl(nextConfig);
