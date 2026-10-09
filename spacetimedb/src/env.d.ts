// The shared solo engine mentions process.env in code paths the module never
// runs; this keeps the type-checker happy without pulling in Node types.
declare const process: { env: Record<string, string | undefined> };
