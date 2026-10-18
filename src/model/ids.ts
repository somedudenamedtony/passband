// D1: client-generated UUIDs so records can be uploaded later without renumbering.
export function newId(): string {
  return crypto.randomUUID();
}
