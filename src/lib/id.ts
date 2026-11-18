/** Short, sortable, collision-resistant id for local records and file names. */
export function newId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
