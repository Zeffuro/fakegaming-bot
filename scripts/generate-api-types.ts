import fs from 'fs';
import path from 'path';
import openapiTS, { astToString, type OpenAPI3 } from 'openapi-typescript';
import { bootstrapEnv, getLogger } from '@zeffuro/fakegaming-common';

const log = getLogger({ name: 'gen:api-types' });
const { __dirname: ROOT } = bootstrapEnv(import.meta.url);

async function main(): Promise<void> {
    const openApiPath = path.resolve(ROOT, '../packages/api/openapi.json');
    const outDir = path.resolve(ROOT, '../packages/common/types');
    const outFile = path.join(outDir, 'api.d.ts');

    if (!fs.existsSync(openApiPath)) {
        throw new Error(`[generate-api-types] Missing OpenAPI file at ${openApiPath}. Build API first.`);
    }
    const openApiText = fs.readFileSync(openApiPath, 'utf8');
    const schema = JSON.parse(openApiText) as OpenAPI3;

    // Generate types from OpenAPI
    const nodes = await openapiTS(schema);
    const dts = astToString(nodes);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(outFile, dts);
    log.info({ outFile }, 'Wrote OpenAPI types');
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
