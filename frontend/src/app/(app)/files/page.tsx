import type { Metadata } from "next";
import { Suspense } from "react";

import { TableSkeleton } from "@/components/shared/table-skeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { FileDropzone } from "@/features/files/components/file-dropzone";
import { FileSearch } from "@/features/files/components/file-search";
import { FilesTable } from "@/features/files/components/files-table";
import { loadFileSearchParams } from "@/features/files/search-params";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Files" };

export default async function FilesPage({ searchParams }: PageProps<"/files">) {
  const user = await requireUser();

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Files</h1>
        <p className="text-sm text-muted-foreground">Shared with everyone in your organization.</p>
      </div>
      <FileDropzone />
      <Suspense fallback={<Skeleton className="h-9 w-full sm:max-w-xs" />}>
        <FileSearch />
      </Suspense>
      <Suspense fallback={<TableSkeleton label="Loading files" />}>
        <FileResults searchParams={searchParams} currentUserId={user.id} />
      </Suspense>
    </>
  );
}

async function FileResults({
  searchParams,
  currentUserId,
}: Pick<PageProps<"/files">, "searchParams"> & { currentUserId: string }) {
  const filters = await loadFileSearchParams(searchParams);
  return <FilesTable filters={filters} currentUserId={currentUserId} />;
}
