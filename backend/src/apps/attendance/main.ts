import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";

import { AttendanceServiceModule } from "@/apps/attendance/attendance.module.js";
import { AppConfig } from "@/config/config.module.js";
import { configureApp } from "@/configure-app.js";

const app = await NestFactory.create<NestExpressApplication>(AttendanceServiceModule, {
  bufferLogs: true,
  bodyParser: false, // configureApp registers it with a size limit
});
configureApp(app);
await app.listen(app.get(AppConfig).get("ATTENDANCE_SERVICE_PORT"));
