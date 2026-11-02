import { ClientProxyFactory, Transport } from "@nestjs/microservices";

import { firstValueFrom } from "rxjs";

import { RPC } from "@/common/contracts/rpc.js";
import { envSchema } from "@/config/env.js";

import "dotenv/config";

/**
 * Asks the employee service to send every organization, division and employee to the
 * attendance service again. Use it to fill a new database or repair a stale copy.
 */
const env = envSchema.parse(process.env);
const client = ClientProxyFactory.create({
  transport: Transport.TCP,
  options: { host: env.EMPLOYEE_RPC_HOST, port: env.EMPLOYEE_RPC_PORT },
});
const sent = await firstValueFrom(client.send(RPC.resyncDirectory, {}));
console.warn("Queued for the attendance service:", sent);
await client.close();
