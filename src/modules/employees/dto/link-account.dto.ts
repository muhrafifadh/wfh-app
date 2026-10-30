import { createZodDto } from "nestjs-zod";
import { z } from "zod";

import { emailSchema } from "@/modules/auth/dto/password.js";

/**
 * Gives the employee a sign-in: "invite" creates a user (named after the employee)
 * and emails the invitation; "link" attaches a user that already exists.
 * One flat object rather than a union, so it can be a DTO class.
 */
export const linkAccountSchema = z
  .strictObject({
    mode: z.enum(["invite", "link"]),
    /** mode "invite": the new user's email. */
    email: emailSchema.optional(),
    /** mode "link": the existing user. */
    userId: z.uuid("Choose a user").optional(),
    /** Required to invite. When linking, leave out to keep the user's current role. */
    roleId: z.uuid("Choose a role").optional(),
  })
  .superRefine((value, ctx) => {
    const require = (field: "email" | "userId" | "roleId", message: string) => {
      if (value[field] === undefined) ctx.addIssue({ code: "custom", path: [field], message });
    };
    const forbid = (field: "email" | "userId") => {
      if (value[field] !== undefined) {
        ctx.addIssue({
          code: "custom",
          path: [field],
          message: `Not used with mode "${value.mode}"`,
        });
      }
    };
    if (value.mode === "invite") {
      require("email", "Enter an email");
      require("roleId", "Choose a role");
      forbid("userId");
    } else {
      require("userId", "Choose a user");
      forbid("email");
    }
  });

export type LinkAccountInput = z.infer<typeof linkAccountSchema>;

export class LinkAccountDto extends createZodDto(linkAccountSchema) {}
