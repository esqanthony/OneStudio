import { Directory, File, Paths } from 'expo-file-system';

/** Reads JSON from a file in the documents directory; returns `fallback` if missing or corrupt. */
export function readJson<T>(file: File, fallback: T): T {
  try {
    if (!file.exists) return fallback;
    return JSON.parse(file.textSync()) as T;
  } catch {
    return fallback;
  }
}

/** Writes JSON atomically enough for our needs: write a temp file, then swap it in. */
export function writeJson(file: File, value: unknown): void {
  const parent = file.parentDirectory;
  if (!parent.exists) parent.create({ intermediates: true, idempotent: true });
  const temp = new File(parent, `${file.name}.tmp`);
  if (temp.exists) temp.delete();
  temp.create();
  temp.writeSync(JSON.stringify(value));
  if (file.exists) file.delete();
  temp.moveSync(file);
}

export function documentsDir(...segments: string[]): Directory {
  return new Directory(Paths.document, ...segments);
}
