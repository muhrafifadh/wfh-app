import type { Prisma } from "@/generated/employee-db/client.js";
import type { PrismaService } from "@/infra/employee-db/prisma.service.js";

/** Pass to repository methods so they can run inside a service's transaction. */
export type Tx = Prisma.TransactionClient | PrismaService;
