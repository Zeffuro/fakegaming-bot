// filepath: packages/common/src/utils/typeUtils.ts

/**
 * Cast a runtime-validated value to a compile-time type without using `as any`.
 * Use this immediately after Zod (or similar) validation to narrow req.body/query.
 */
export function asValidated<T>(value: unknown): T {
    return value as T;
}

