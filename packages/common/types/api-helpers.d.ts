import type { components, paths } from "@zeffuro/fakegaming-common/api-types";

// Stable helper types for generated OpenAPI declarations.

export type ApiPath = keyof paths;
export type ApiSchemaName = keyof components["schemas"];
export type ApiSchema<Name extends ApiSchemaName> = components["schemas"][Name];
export type ApiHttpMethod = "get" | "put" | "post" | "delete" | "options" | "head" | "patch" | "trace";

type ApiOperationFor<
    Path extends ApiPath,
    Method extends ApiHttpMethod,
> = Method extends keyof paths[Path] ? NonNullable<paths[Path][Method]> : never;

export type ApiMethod<Path extends ApiPath> = {
    [Method in ApiHttpMethod]: ApiOperationFor<Path, Method> extends never ? never : Method;
}[ApiHttpMethod];

export type ApiOperation<
    Path extends ApiPath,
    Method extends ApiHttpMethod,
> = ApiOperationFor<Path, Method>;

type ApiResponses<
    Path extends ApiPath,
    Method extends ApiHttpMethod,
> = ApiOperation<Path, Method> extends { responses: infer Responses } ? Responses : never;

export type ApiResponseStatus<
    Path extends ApiPath,
    Method extends ApiHttpMethod,
> = keyof ApiResponses<Path, Method>;

export type ApiJsonResponse<
    Path extends ApiPath,
    Method extends ApiHttpMethod,
    Status extends ApiResponseStatus<Path, Method>,
> = ApiResponses<Path, Method>[Status] extends { content: { "application/json": infer Body } } ? Body : never;

export type ApiJsonRequestBody<
    Path extends ApiPath,
    Method extends ApiHttpMethod,
> = ApiOperation<Path, Method> extends { requestBody: { content: { "application/json": infer Body } } } ? Body : never;

export type ApiQueryParams<
    Path extends ApiPath,
    Method extends ApiHttpMethod,
> = ApiOperation<Path, Method> extends { parameters: { query: infer Params } } ? Params : never;

export type ApiPathParams<
    Path extends ApiPath,
    Method extends ApiHttpMethod,
> = ApiOperation<Path, Method> extends { parameters: { path: infer Params } } ? Params : never;
