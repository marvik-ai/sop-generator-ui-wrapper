import type { PickedFile } from '../types';

// Mirrors what the pipeline's ingest layer actually reads; the backend rejects
// anything else, so don't offer it here.
export const ACCEPT = '.txt,.md,.markdown,.docx,.mp4';
export const HINT = 'TXT, MD, DOCX, or MP4';

function readEntryAsFile(entry: FileSystemFileEntry): Promise<File> {
  return new Promise((resolve, reject) => entry.file(resolve, reject));
}

function readDirectoryEntries(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  return new Promise((resolve, reject) => reader.readEntries(resolve, reject));
}

// A dropped folder is walked exactly one level deep — the pipeline treats a
// subdirectory of inputs/ as one related-document set and ignores anything nested
// further inside it (see sop_pipeline/ingest.py's `_load_folder`), so uploading
// deeper nesting would just be wasted bandwidth.
export async function collectFromDataTransfer(dataTransfer: DataTransfer): Promise<PickedFile[]> {
  const picked: PickedFile[] = [];

  for (const item of Array.from(dataTransfer.items)) {
    const entry = item.webkitGetAsEntry?.();
    if (!entry) continue;

    if (entry.isFile) {
      const file = await readEntryAsFile(entry as FileSystemFileEntry);
      picked.push({ file, relativePath: file.name });
      continue;
    }

    if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      const children: FileSystemEntry[] = [];
      // readEntries() can return results in batches, so keep calling until empty.
      let batch = await readDirectoryEntries(reader);
      while (batch.length > 0) {
        children.push(...batch);
        batch = await readDirectoryEntries(reader);
      }
      for (const child of children) {
        if (!child.isFile) continue;
        const file = await readEntryAsFile(child as FileSystemFileEntry);
        picked.push({ file, relativePath: `${entry.name}/${file.name}` });
      }
    }
  }

  return picked;
}

export function collectFromFileList(fileList: FileList | null): PickedFile[] {
  return Array.from(fileList ?? []).map((file) => ({
    file,
    relativePath: file.webkitRelativePath || file.name,
  }));
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}
