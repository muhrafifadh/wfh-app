import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC = "isPublic";

/** Opts a route out of authentication (docs/08-authentication.md). Review every use. */
export const Public = () => SetMetadata(IS_PUBLIC, true);
