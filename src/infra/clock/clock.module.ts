import { Global, Module } from "@nestjs/common";

import { Clock, SystemClock } from "@/infra/clock/clock.js";

/** Inject Clock, never call new Date() for business time. Tests swap in FixedClock. */
@Global()
@Module({
  providers: [{ provide: Clock, useClass: SystemClock }],
  exports: [Clock],
})
export class ClockModule {}
