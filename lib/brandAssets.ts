/** Icon-content fingerprint is computed in next.config at build/dev startup. */
export function brandAsset(path: string): string {
  const version = process.env.NEXT_PUBLIC_BRAND_ICON_VERSION || "leaf-blue";
  return `${path}?v=${version}`;
}
