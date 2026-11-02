import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";

import type { NestExpressApplication } from "@nestjs/platform-express";

import helmet from "helmet";
import { createProxyMiddleware } from "http-proxy-middleware";
import { Logger } from "nestjs-pino";

import { serviceFor } from "@/apps/gateway/routes.js";
import { REQUEST_ID_HEADER } from "@/common/http/request-id.js";
import { AppConfig } from "@/config/config.module.js";

/**
 * Forwards every request except its own /health to the service that owns it. Bodies are
 * streamed untouched (no parser here), which is also what keeps the CSV export unbuffered.
 */
export function configureGateway(app: NestExpressApplication): NestExpressApplication {
  const config = app.get(AppConfig);
  const employee = config.get("EMPLOYEE_SERVICE_URL");
  const attendance = config.get("ATTENDANCE_SERVICE_URL");

  app.useLogger(app.get(Logger));
  app.set("trust proxy", config.get("TRUST_PROXY"));
  app.use(
    createProxyMiddleware<IncomingMessage, ServerResponse>({
      target: employee,
      router: (req) => (serviceFor(req.url ?? "/") === "attendance" ? attendance : employee),
      pathFilter: (path) => !path.startsWith("/health"),
      changeOrigin: false,
      // Adds the caller's address, so the services' rate limits see the real client
      xfwd: true,
      on: {
        proxyReq: (proxyReq, req) => {
          const id = req.headers[REQUEST_ID_HEADER] ?? randomUUID();
          proxyReq.setHeader(REQUEST_ID_HEADER, id);
        },
        error: (_error, _req, res) => {
          if (!("writeHead" in res) || res.headersSent) return;
          res.writeHead(503, { "content-type": "application/json" });
          res.end(
            JSON.stringify({
              error: {
                code: "SERVICE_UNAVAILABLE",
                message: "The service is temporarily unavailable. Try again shortly.",
              },
            }),
          );
        },
      },
    }),
  );
  app.use(helmet()); // After the proxy: the services set their own headers
  app.enableShutdownHooks();
  return app;
}
