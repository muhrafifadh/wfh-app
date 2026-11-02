import { LoggerModule } from "nestjs-pino";

import { REQUEST_ID_HEADER, resolveRequestId } from "@/common/http/request-id.js";
import { AppConfig } from "@/config/config.module.js";

export const loggerModule = () =>
  LoggerModule.forRootAsync({
    inject: [AppConfig],
    useFactory: (config: AppConfig) => ({
      pinoHttp: {
        level: config.get("LOG_LEVEL"),
        genReqId: (req, res) => {
          const id = resolveRequestId(req);
          res.setHeader(REQUEST_ID_HEADER, id);
          return id;
        },
        // docs/12-logging-and-observability.md — never log secrets
        redact: [
          "req.headers.authorization",
          "req.headers.cookie",
          "*.password",
          "*.passwordHash",
          "*.refreshToken",
          "*.accessToken",
          "*.token",
        ],
        autoLogging: {
          ignore: (req) => req.url?.startsWith("/health") ?? false,
        },
        transport: config.isProduction
          ? undefined
          : { target: "pino-pretty", options: { singleLine: true } },
      },
    }),
  });
