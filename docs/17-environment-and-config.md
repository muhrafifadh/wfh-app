# 17 · Environment & Config

## Environment variables

### Rules

- **All env vars are validated at startup in `src/lib/env.ts`.** A missing or invalid variable fails the build. Nothing should fail later in production because of a missing value.
- **Import `env` from `@/lib/env`.** Never read `process.env` anywhere else (ESLint enforces this).
- **Only variables prefixed with `NEXT_PUBLIC_` reach the browser.** Their values are written into the client JavaScript at build time.
- **Secrets never get the `NEXT_PUBLIC_` prefix:** API keys, client secrets, signing keys.
- **`.env.example` lists every variable with a placeholder value** and a comment. It is committed. `.env*.local` files are never committed.
- **When you add a variable, update `env.ts`, `.env.example`, and the deployment's environment settings in the same PR.**

### `env.ts`

```ts
// src/lib/env.ts
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    API_URL: z.url(),
    SESSION_SECRET: z.string().min(32),
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  },
  client: {
    NEXT_PUBLIC_APP_URL: z.url(),
  },
  runtimeEnv: {
    API_URL: process.env.API_URL,
    SESSION_SECRET: process.env.SESSION_SECRET,
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },
  emptyStringAsUndefined: true,
});
```

`createEnv` throws if client code reads a server variable, so secrets can't leak into the browser by accident.

### `.env.example`

```bash
# Backend base URL (server only)
API_URL=http://localhost:8000/v1
# 32+ random characters: openssl rand -base64 32
SESSION_SECRET=replace-me-with-32-plus-random-characters
# Public URL of this app
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Static config

App-wide constants go in `src/config/`, never as magic values scattered through the code:

| File                  | Contents                                                  |
| --------------------- | --------------------------------------------------------- |
| `config/site.ts`      | App name, description, default metadata, social links     |
| `config/routes.ts`    | Route builders: `routes.invoice(id)` → `/invoices/${id}`  |
| `config/nav.ts`       | Navigation items (label, href, icon, required permission) |
| `config/constants.ts` | `PAGE_SIZE`, `MAX_UPLOAD_BYTES`, debounce delays          |

Constants used by only one feature stay in that feature (`features/<f>/constants.ts`).

## Feature flags

- Feature flags are read on the server through one helper (`lib/flags.ts`), and the result is passed down as props.
- Remove a flag and its old code path within one release after the feature is fully rolled out.

## Don't

- **Don't write `process.env.X!` anywhere.** That's exactly the problem `env.ts` solves.
- **Don't put secrets in `next.config.ts` `env`.** Everything there gets written into the client bundle.
- **Don't let code behave differently depending on `NODE_ENV`** except for logging and dev tooling. Use a flag or an env var instead.

## Related

[12 Authentication](12-authentication.md) · [18 Tooling & Git](18-tooling-and-git.md)
