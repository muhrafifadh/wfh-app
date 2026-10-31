import type { Prisma } from "@/generated/prisma/client.js";
import type { PrismaService } from "@/infra/prisma/prisma.service.js";

/** Pass to repository methods so they can run inside a service's transaction. */
export type Tx = Prisma.TransactionClient | PrismaService;
