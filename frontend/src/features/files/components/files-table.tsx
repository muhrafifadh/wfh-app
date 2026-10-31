import Link from "next/link";

import { DownloadIcon } from "lucide-react";

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
import { FileDeleteButton } from "@/features/files/components/file-row-actions";
import { FILE_TYPE_LABELS } from "@/features/files/constants";
import { listFiles } from "@/features/files/queries";
import { fileListHref, type FileFilters } from "@/features/files/search-params";
import { formatBytes, formatDate } from "@/lib/format";

export async function FilesTable({
  filters,
  currentUserId,
}: {
  filters: FileFilters;
  currentUserId: string;
}) {
  const result = await listFiles(filters);

  if (result.total === 0) {
    return filters.q ? (
      <EmptyState
        title="No files match your search"
        action={
          <Button variant="outline" asChild>
            <Link href={routes.files()}>Clear search</Link>
          </Button>
        }
      />
    ) : (
      <EmptyState title="No files yet" description="Files you and your team upload show up here." />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Name</TableHead>
              <TableHead scope="col" className="hidden sm:table-cell">
                Size
              </TableHead>
              <TableHead scope="col" className="hidden md:table-cell">
                Uploaded by
              </TableHead>
              <TableHead scope="col" className="hidden md:table-cell">
                Date
              </TableHead>
              <TableHead scope="col" className="w-20">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.items.map((file) => (
              <TableRow key={file.id}>
                <TableCell className="whitespace-normal">
                  <span className="block font-medium break-all">{file.filename}</span>
                  <span className="block text-xs text-muted-foreground">
                    {FILE_TYPE_LABELS[file.contentType]}
                  </span>
                </TableCell>
                <TableCell className="hidden tabular-nums sm:table-cell">
                  {formatBytes(file.size)}
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  {file.uploadedBy.id === currentUserId ? "You" : file.uploadedBy.name}
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  {formatDate(file.createdAt.slice(0, 10))}
                </TableCell>
                <TableCell className="px-1">
                  <div className="flex justify-end">
                    {file.downloadUrl && (
                      <Button variant="ghost" size="icon" asChild>
                        {/* A signed storage link: plain <a>, valid for 15 minutes */}
                        <a href={file.downloadUrl} aria-label={`Download ${file.filename}`}>
                          <DownloadIcon aria-hidden />
                        </a>
                      </Button>
                    )}
                    {file.uploadedBy.id === currentUserId && (
                      <FileDeleteButton file={{ id: file.id, filename: file.filename }} />
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ListPagination
        page={result.page}
        pageSize={result.pageSize}
        total={result.total}
        hrefFor={(page) => fileListHref({ ...filters, page })}
      />
    </div>
  );
}
