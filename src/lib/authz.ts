/** Authorization value types (roles/status live as strings in the DB with
 *  Better Auth; these keep them type-safe across client and server). */
export type UserRole = "AGENT" | "ADMIN";
export type UserStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED";

export const AGENT_ROLES: readonly UserRole[] = ["AGENT", "ADMIN"];
export const ADMIN_ROLES: readonly UserRole[] = ["ADMIN"];
