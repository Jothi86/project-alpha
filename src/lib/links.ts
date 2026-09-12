// Resolves a stored link value against the current BASE_URL: absolute URLs pass
// through untouched, root-relative paths (self-hosted assets in public/) get the
// base prefix so they keep working across a host or base-path change.
export function resolveLink(value: string | undefined, base: string): string | undefined {
  if (!value) return undefined;
  return value.startsWith('/') ? `${base}${value}` : value;
}
