import type { Prisma } from "@/generated/attendance-db/client.js";
import type { PrismaService } from "@/infra/attendance-db/prisma.service.js";

/** Pass to repository methods so they can run inside a service's transaction. */
export type Tx = Prisma.TransactionClient | PrismaService;
