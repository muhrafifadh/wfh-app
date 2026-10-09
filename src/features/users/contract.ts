import type {
  inviteUserSchema,
  roleListSchema,
  updateUserSchema,
  userListSchema,
  userSchema,
} from "@/features/users/schemas";
import type { ApiSchema, Equal, Expect } from "@/lib/api/contract";

import type { z } from "zod";

// Compile-time checks: these schemas must match the backend contract exactly.
// If one fails, run `pnpm api:types` and update the schema (see docs/08-data-fetching.md).

// What we send (the form always sends both fields; the API accepts either)
export type _InviteUser = Expect<
  Equal<z.output<typeof inviteUserSchema>, ApiSchema<"InviteUserDto">>
>;
export type _UpdateUser = Expect<
  Equal<Partial<z.output<typeof updateUserSchema>>, ApiSchema<"UpdateUserDto">>
>;

// What we receive
export type _User = Expect<Equal<z.output<typeof userSchema>, ApiSchema<"UserResponse_Output">>>;
export type _UserList = Expect<
  Equal<z.output<typeof userListSchema>, ApiSchema<"UserListResponse_Output">>
>;
export type _RoleList = Expect<
  Equal<z.output<typeof roleListSchema>, ApiSchema<"RoleListResponse_Output">>
>;
