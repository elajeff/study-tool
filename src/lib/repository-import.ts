import { matchImportFiles, type ImportFile } from "./import-files.ts";

export type RepositoryFile = { artifact_id: string; path: string | null; revision_id: string | null; content_hash: string | null };

export function repositoryArchiveRoot(paths: string[]): string | null {
  const root = paths[0]?.split("/")[0];
  return root && paths.every(path => path.startsWith(`${root}/`)) ? root : null;
}

export function shouldImportRepositoryFile(path: string, includeOtherText = false) {
  if (/(^|\/)(\.git|node_modules|vendor|dist|build|target|out|coverage|\.next|\.venv|venv|__pycache__|\.idea)(\/|$)/i.test(path)) return false;
  const name = path.split("/").at(-1)!;
  if (/^(\.env(?:\..*)?|id_(rsa|dsa|ecdsa|ed25519)|credentials(?:\..*)?|secrets?\.(json|ya?ml|txt)|package-lock\.json|pnpm-lock\.yaml)$/i.test(name)
    || /\.(pem|key|p12|pfx|jks|keystore|min\.js|map)$/i.test(name)) return false;
  const supported = /\.(java|tsx?|[cm]?jsx?|py|sql|ya?ml|json|md|markdown|rst|html|css|scss|xml|properties|toml|conf|cfg|ini|gradle|sh|ps1|bat|cmd|txt|c|h|cpp|go|rs|kt|rb)$/i.test(name)
    || /^(Dockerfile|Makefile|mvnw|gradlew|\.gitignore|\.dockerignore)$/i.test(name);
  if (supported) return true;
  return includeOtherText && !path.split("/").some(part => part.startsWith(".")) ? "optional" as const : false;
}

export { inspectImportText as inspectRepositoryText } from "./import-privacy.ts";

export function previewRepository(files: ImportFile[], state: RepositoryFile[], bindings: Record<string, string> = {}) {
  return matchImportFiles(files, state, bindings).map((row) => ({ ...row,
    status: row.identityConflict ? "Conflict" : !row.previous ? "New" : row.previous.content_hash === row.file.hash ? "Unchanged" : "Updated",
  }));
}
