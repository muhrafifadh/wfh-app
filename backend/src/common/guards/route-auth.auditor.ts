import { Injectable, type OnApplicationBootstrap } from "@nestjs/common";
import { PATH_METADATA } from "@nestjs/common/constants.js";
import { DiscoveryService, MetadataScanner, Reflector } from "@nestjs/core";

import { IS_AUTHENTICATED } from "@/common/decorators/authenticated.decorator.js";
import { IS_PUBLIC } from "@/common/decorators/public.decorator.js";
import { PERMISSIONS_KEY } from "@/common/decorators/require-permissions.decorator.js";

/**
 * docs/09-authorization.md — refuses to start the app if any route is missing
 * an explicit access decision (@Public, @Authenticated or @RequirePermissions).
 */
@Injectable()
export class RouteAuthAuditor implements OnApplicationBootstrap {
  constructor(
    private readonly discovery: DiscoveryService,
    private readonly scanner: MetadataScanner,
    private readonly reflector: Reflector,
  ) {}

  onApplicationBootstrap(): void {
    const missing = this.findUndecoratedRoutes();
    if (missing.length > 0) {
      throw new Error(
        `Routes without @Public(), @Authenticated() or @RequirePermissions(): ${missing.join(", ")}`,
      );
    }
  }

  findUndecoratedRoutes(): string[] {
    const missing: string[] = [];

    for (const wrapper of this.discovery.getControllers()) {
      const { metatype, instance } = wrapper;
      if (!metatype || !instance) continue;
      const prototype = Object.getPrototypeOf(instance) as object;

      for (const name of this.scanner.getAllMethodNames(prototype)) {
        const handler = (prototype as Record<string, unknown>)[name];
        if (typeof handler !== "function") continue;
        if (Reflect.getMetadata(PATH_METADATA, handler) === undefined) continue;

        const targets = [handler, metatype];
        const decided =
          this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets) ||
          this.reflector.getAllAndOverride<boolean>(IS_AUTHENTICATED, targets) ||
          (this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, targets)?.length ?? 0) > 0;

        if (!decided) missing.push(`${metatype.name}.${name}`);
      }
    }
    return missing;
  }
}
