import type { INestApplication } from "@nestjs/common";
import { Transport, type TcpOptions } from "@nestjs/microservices";

import { AppConfig } from "@/config/config.module.js";

/**
 * Adds the TCP listener the attendance service calls. It doesn't inherit the HTTP
 * guards, so it must stay on a private network (127.0.0.1 here).
 */
export function connectEmployeeRpc(app: INestApplication): void {
  const config = app.get(AppConfig);
  app.connectMicroservice<TcpOptions>({
    transport: Transport.TCP,
    options: { host: config.get("EMPLOYEE_RPC_HOST"), port: config.get("EMPLOYEE_RPC_PORT") },
  });
}
