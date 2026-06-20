import type { ApiJsonResponse, ApiSchema } from "@zeffuro/fakegaming-common/api-helpers";
import { API_ENDPOINTS, apiRequest } from "./core";

type DisabledModulesResponse = ApiJsonResponse<"/disabledModules", "get", 200>;
type DisabledModuleCreateRequest = ApiSchema<"DisabledModuleCreateRequest">;
type DisabledModuleCreateResponse = ApiJsonResponse<"/disabledModules", "post", 201>;
type DisabledModuleDeleteResponse = ApiJsonResponse<"/disabledModules/{id}", "delete", 200>;
type DisabledCommandsResponse = ApiJsonResponse<"/disabledCommands", "get", 200>;
type DisabledCommandCreateRequest = ApiSchema<"DisabledCommandCreateRequest">;
type DisabledCommandCreateResponse = ApiJsonResponse<"/disabledCommands", "post", 201>;
type DisabledCommandDeleteResponse = ApiJsonResponse<"/disabledCommands/{id}", "delete", 200>;

export function createDisabledModuleRequest(data: DisabledModuleCreateRequest): Promise<DisabledModuleCreateResponse>;
export function createDisabledModuleRequest(data: { guildId: string; moduleName: string }): Promise<DisabledModuleCreateResponse>;
export async function createDisabledModuleRequest(data: DisabledModuleCreateRequest | { guildId: string; moduleName: string }): Promise<DisabledModuleCreateResponse> {
    return apiRequest<DisabledModuleCreateResponse>(API_ENDPOINTS.DISABLED_MODULES, { method: "POST", body: data });
}

export const disabledFeaturesApi = {
    getDisabledModules: (guildId: string) =>
        apiRequest<DisabledModulesResponse>(`${API_ENDPOINTS.DISABLED_MODULES}?guildId=${encodeURIComponent(guildId)}`),

    createDisabledModule: createDisabledModuleRequest,

    deleteDisabledModule: (id: string | number) =>
        apiRequest<DisabledModuleDeleteResponse>(`${API_ENDPOINTS.DISABLED_MODULES}/${id}`, { method: "DELETE" }),

    getDisabledCommands: (guildId: string) =>
        apiRequest<DisabledCommandsResponse>(`${API_ENDPOINTS.DISABLED_COMMANDS}?guildId=${encodeURIComponent(guildId)}`),

    createDisabledCommand: (data: DisabledCommandCreateRequest) =>
        apiRequest<DisabledCommandCreateResponse>(API_ENDPOINTS.DISABLED_COMMANDS, { method: "POST", body: data }),

    deleteDisabledCommand: (id: string | number) =>
        apiRequest<DisabledCommandDeleteResponse>(`${API_ENDPOINTS.DISABLED_COMMANDS}/${id}`, { method: "DELETE" }),
};
