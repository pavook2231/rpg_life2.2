declare interface NodeRequire {
  context(
    path: string,
    recursive?: boolean,
    filter?: RegExp,
    mode?: "sync" | "eager" | "lazy" | "lazy-once",
  ): {
    keys(): string[];
    <T = unknown>(id: string): T;
    resolve(id: string): string;
    id: string;
  };
}
