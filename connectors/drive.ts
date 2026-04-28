// Stub for Google Drive (Idea Brain Google Doc) writes. The real implementation
// will append `line` to the document identified by `docId`. See
// connectors/calendar.ts for the rationale on stubbing.

export type DriveAppendInput = {
  docId: string;
  line: string;
};

export async function appendToDoc(input: DriveAppendInput): Promise<void> {
  console.log("[STUB] connectors/drive.ts → appendToDoc would be called with:");
  console.log(JSON.stringify(input, null, 2));
}
