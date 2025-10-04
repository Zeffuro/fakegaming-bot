import fs from "fs";
import path from "path";
import { swaggerSpec } from "../src/app.js";
import {bootstrapEnv} from "@zeffuro/fakegaming-common/core";
import {getConfigManager} from "@zeffuro/fakegaming-common/managers";
import {injectOpenApiSchemas} from "../src/utils/openapi-inject-schemas.js";
const {__dirname} = bootstrapEnv(import.meta.url);

process.env.DATABASE_PROVIDER = 'sqlite';
await getConfigManager().init(true);

// Inject schemas before exporting
injectOpenApiSchemas(swaggerSpec);

// Write the OpenAPI spec to disk
const outputPath = path.resolve(__dirname, "../openapi.json");
fs.writeFileSync(outputPath, JSON.stringify(swaggerSpec, null, 2));
console.log(`Exported OpenAPI spec to ${outputPath}`);
