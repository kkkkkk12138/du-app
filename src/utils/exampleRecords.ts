export const exampleRecordPrefix = 'example-';

export function isExampleRecord(recordOrId?: string | { id: string } | null) {
  const id = typeof recordOrId === 'string' ? recordOrId : recordOrId?.id;
  return Boolean(
    id?.startsWith(exampleRecordPrefix) || id?.startsWith('seed-'),
  );
}
