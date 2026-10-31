import * as Sentry from "@sentry/nextjs";

import { sentryOptions } from "@/lib/sentry";

// Runs in the browser before the app starts. Session Replay is left out on purpose:
// it records what users see and type. Add replayIntegration() only with a privacy review.
Sentry.init(sentryOptions);

/** Lets Sentry time client-side navigations. */
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
