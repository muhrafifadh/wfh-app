import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";
import { ListPagination } from "@/components/shared/list-pagination";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { routes } from "@/config/routes";
import { auditActionLabel } from "@/features/audit/constants";
import { listAuditLogs } from "@/features/audit/queries";
import type { AuditLog } from "@/features/audit/schemas";
import { auditListHref, type AuditFilters } from "@/features/audit/search-params";
import { formatDateTime } from "@/lib/format";

/** Metadata as short "key: value" lines (ip, changed fields, role change). */
function describeMetadata(metadata: AuditLog["metadata"]): string[] {
  const lines: string[] = [];
  const { role, roleFrom, roleTo, fields, ip, ...rest } = metadata;
  if (typeof role === "string") lines.push(`Role: ${role}`);
  if (typeof roleFrom === "string" && typeof roleTo === "string") {
    lines.push(`Role: ${roleFrom} → ${roleTo}`);
  }
  if (Array.isArray(fields)) lines.push(`Changed: ${fields.join(", ")}`);
  if (typeof ip === "string") lines.push(`IP: ${ip}`);
  for (const [key, value] of Object.entries(rest)) {
    if (["string", "number", "boolean"].includes(typeof value))
      lines.push(`${key}: ${String(value)}`);
  }
  return lines;
}

export async function AuditLogTable({ filters }: { filters: AuditFilters }) {
  const result = await listAuditLogs(filters);

  if (result.total === 0) {
    return filters.action ? (
      <EmptyState
        title="Nothing recorded for this action"
        action={
          <Button variant="outline" asChild>
            <Link href={routes.auditLog()}>Show all actions</Link>
          </Button>
        }
      />
    ) : (
      <EmptyState
        title="Nothing recorded yet"
        description="Sign-ins and changes to users show up here."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">When</TableHead>
              <TableHead scope="col">Who</TableHead>
              <TableHead scope="col">What</TableHead>
              <TableHead scope="col" className="hidden md:table-cell">
                Details
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.items.map((entry) => {
              const details = describeMetadata(entry.metadata);
              return (
                <TableRow key={entry.id}>
                  <TableCell className="text-muted-foreground tabular-nums">
                    {formatDateTime(entry.createdAt)}
                  </TableCell>
                  <TableCell className="whitespace-normal">
                    {entry.actor ? (
                      <>
                        <span className="block font-medium">{entry.actor.name}</span>
                        <span className="block text-xs text-muted-foreground">
                          {entry.actor.email}
                        </span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">No signed-in user</span>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-normal">
                    {auditActionLabel(entry.action)}
                    {entry.targetType === "user" &&
                      entry.targetId &&
                      entry.targetId !== entry.actor?.id && (
                        <Link
                          href={routes.user(entry.targetId)}
                          className="block text-xs text-muted-foreground underline underline-offset-4"
                        >
                          View user
                        </Link>
                      )}
                  </TableCell>
                  <TableCell className="hidden text-xs text-muted-foreground md:table-cell">
                    {details.length > 0 ? (
                      <ul>
                        {details.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <ListPagination
        page={result.page}
        pageSize={result.pageSize}
        total={result.total}
        hrefFor={(page) => auditListHref({ ...filters, page })}
      />
    </div>
  );
}
