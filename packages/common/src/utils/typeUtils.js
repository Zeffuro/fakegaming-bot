/**
 * Cast a runtime-validated value to a compile-time type without using `as any`.
 * Use this immediately after Zod (or similar) validation to narrow req.body/query.
 */
export function asValidated(value) {
    return value;
}
