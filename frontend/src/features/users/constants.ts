// Same values as the backend's src/modules/users/users.constants.ts
export const USER_STATUSES = ["active", "invited", "deactivated"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const USER_SORT_FIELDS = ["name", "email", "createdAt"] as const;
export type UserSortField = (typeof USER_SORT_FIELDS)[number];

export const SORT_ORDERS = ["asc", "desc"] as const;
