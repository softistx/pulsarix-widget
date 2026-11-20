import {
  ACCEPTED_TYPES,
  MAX_FILE_BYTES,
  MAX_TOTAL_BYTES,
} from "../files/rules";
import { putFile } from "../files/upload";

/** Whether the attached files break the limits (type, size of one, size of all). */
export const filesOversize = (attached: File[]): boolean =>
  attached.some(
    (f) => f.size > MAX_FILE_BYTES || !ACCEPTED_TYPES.includes(f.type),
  ) || attached.reduce((sum, f) => sum + f.size, 0) > MAX_TOTAL_BYTES;

/**
 * Uploads each file to the ticket the API issued at its index; returns the names of those
 * that had no ticket or failed.
 */
export async function uploadFiles({
  apiBase,
  files,
  tickets,
  signal,
}: {
  apiBase: string;
  files: File[];
  tickets: { slot: string; ticket: string }[];
  signal: AbortSignal;
}): Promise<string[]> {
  const failed: string[] = [];
  await Promise.all(
    files.map(async (file, index) => {
      const ticket = tickets[index];
      const result = ticket
        ? await putFile({
            apiBase,
            slot: ticket.slot,
            ticket: ticket.ticket,
            file,
            onProgress: () => {},
            signal,
          })
        : { ok: false as const };
      if (!result.ok) failed.push(file.name);
    }),
  );
  return failed;
}
