/** What one report may carry: a mirror of the API's A12 limits (`intake.files.input.ts`). */

export const ACCEPTED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/pdf",
];
export const MAX_FILE_BYTES = 5 * 1024 * 1024;
/** Files other than the screenshot. */
export const MAX_ATTACHED = 3;
/** The screenshot and the files together. */
export const MAX_TOTAL_BYTES = 12 * 1024 * 1024;

const EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

/** The screenshot's name in the report: the export has none worth showing. */
export function screenshotName(type: string): string {
  return `screenshot.${EXTENSIONS[type] ?? "png"}`;
}

/**
 * A flattened export can pass the 5 MB limit (a 2560 px PNG of a busy page). It is re-encoded
 * as WebP, lower quality step by step, until it fits; null when even the last step does not.
 * Redaction boxes are solid colour, so they stay solid and hide what they hid.
 */
export async function fitScreenshot(file: File): Promise<File | null> {
  if (file.size <= MAX_FILE_BYTES) return file;
  if (typeof createImageBitmap !== "function") return null;
  try {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0);
    bitmap.close();
    for (const quality of [0.9, 0.75, 0.6]) {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/webp", quality),
      );
      if (blob && blob.type === "image/webp" && blob.size <= MAX_FILE_BYTES)
        return new File([blob], "screenshot.webp", { type: "image/webp" });
    }
  } catch {
    // Unreadable: the caller words it as a refused file.
  }
  return null;
}
