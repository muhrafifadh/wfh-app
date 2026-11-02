import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";

import { connectEmployeeRpc } from "@/apps/employee/connect-rpc.js";
import { EmployeeServiceModule } from "@/apps/employee/employee.module.js";
import { AppConfig } from "@/config/config.module.js";
import { configureApp } from "@/configure-app.js";

const app = await NestFactory.create<NestExpressApplication>(EmployeeServiceModule, {
  bufferLogs: true,
  bodyParser: false, // configureApp registers it with a size limit
});
configureApp(app);
connectEmployeeRpc(app);
await app.startAllMicroservices();
await app.listen(app.get(AppConfig).get("EMPLOYEE_SERVICE_PORT"));
