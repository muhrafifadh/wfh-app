"use client";

import { useRef, useState } from "react";

import { UploadIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { completeUploadAction, startUploadAction } from "@/features/files/actions";
import { ACCEPT, MAX_UPLOAD_BYTES } from "@/features/files/constants";
import { formatBytes } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Upload in three steps (backend docs/17-file-uploads.md): the server action
 * registers the file and returns a signed URL, the browser PUTs the bytes straight
 * to storage, then the second action asks the backend to check what arrived.
 */
async function uploadFile(file: File): Promise<string | null> {
  const started = await startUploadAction({
    filename: file.name,
    contentType: file.type,
    size: file.size,
  });
  if (!started.ok) return started.error;

  // Straight to storage, not through Next or the API. The signature covers these headers.
  const put = await fetch(started.data.uploadUrl, {
    method: "PUT",
    headers: started.data.uploadHeaders,
    body: file,
  }).catch(() => null);
  if (!put?.ok) return "The upload didn't go through. Check your connection and try again.";

  const completed = await completeUploadAction(started.data.id);
  return completed.ok ? null : completed.error;
}

export function FileDropzone() {
  const input = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    for (const file of Array.from(files ?? [])) {
      setUploading(file.name);
      const error = await uploadFile(file);
      if (error) toast.error(`${file.name}: ${error}`);
      else toast.success(`${file.name} uploaded`);
    }
    setUploading(null);
    if (input.current) input.current.value = "";
  }

  return (
    <section
      aria-label="Upload files"
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragging(false);
        void handleFiles(event.dataTransfer.files);
      }}
      className={cn(
        "flex flex-col items-center gap-3 rounded-lg border border-dashed p-6 text-center transition-colors",
        isDragging && "border-primary bg-muted",
      )}
    >
      <UploadIcon aria-hidden className="size-6 text-muted-foreground" />
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">Drop files here, or choose them</p>
        <p className="text-xs text-muted-foreground">
          Images, PDFs, text and CSV, up to {formatBytes(MAX_UPLOAD_BYTES)} each
        </p>
      </div>
      <input
        ref={input}
        id="file-upload"
        type="file"
        multiple
        accept={ACCEPT}
        className="sr-only"
        onChange={(event) => void handleFiles(event.target.files)}
      />
      <Button
        type="button"
        variant="outline"
        disabled={uploading !== null}
        onClick={() => input.current?.click()}
      >
        {uploading ? "Uploading…" : "Choose files"}
      </Button>
      <p role="status" className="text-xs text-muted-foreground">
        {uploading ? `Uploading ${uploading}…` : ""}
      </p>
    </section>
  );
}
