import { Injectable, type OnModuleDestroy } from "@nestjs/common";
import { ClientProxyFactory, Transport, type ClientProxy } from "@nestjs/microservices";

import { firstValueFrom, timeout } from "rxjs";

import {
  EmployeeServiceUnavailableError,
  RemoteAppError,
  rpcErrorSchema,
} from "@/common/contracts/rpc.js";
import { AppConfig } from "@/config/config.module.js";

const RPC_TIMEOUT_MS = 5_000;

/** The TCP connection to the employee service. Errors come back as AppErrors, codes intact. */
@Injectable()
export class EmployeeServiceClient implements OnModuleDestroy {
  private readonly client: ClientProxy;

  constructor(config: AppConfig) {
    this.client = ClientProxyFactory.create({
      transport: Transport.TCP,
      options: { host: config.get("EMPLOYEE_RPC_HOST"), port: config.get("EMPLOYEE_RPC_PORT") },
    });
  }

  async send<T>(pattern: string, payload: object): Promise<T> {
    try {
      return await firstValueFrom(
        this.client.send<T>(pattern, payload).pipe(timeout(RPC_TIMEOUT_MS)),
      );
    } catch (error) {
      const remote = rpcErrorSchema.safeParse(error);
      if (remote.success) throw new RemoteAppError(remote.data);
      throw new EmployeeServiceUnavailableError();
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.close();
  }
}
