import { Global, Injectable, Module } from "@nestjs/common";
import { ConfigService, ConfigModule as NestConfigModule } from "@nestjs/config";

import { envSchema, type Env } from "@/config/env.js";

/** Typed access to validated config. Inject this instead of reading process.env. */
@Injectable()
export class AppConfig {
  constructor(private readonly config: ConfigService<Env, true>) {}

  get<K extends keyof Env>(key: K): Env[K] {
    return this.config.get(key, { infer: true });
  }

  get isProduction(): boolean {
    return this.get("NODE_ENV") === "production";
  }
}

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      // Vitest sets NODE_ENV=test; tests use the committed .env.test
      envFilePath: process.env.NODE_ENV === "test" ? ".env.test" : ".env",
      validate: (raw) => envSchema.parse(raw),
    }),
  ],
  providers: [AppConfig],
  exports: [AppConfig],
})
export class ConfigModule {}
