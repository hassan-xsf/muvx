export function getWorkspaceLogoImageSource(
  logo: string | null | undefined,
  workspaceId?: string,
) {
  if (!logo) return undefined
  if (/^(?:logos|workspace-logos)\//.test(logo)) {
    return "/api/workspace/logo"
  }

  try {
    const url = new URL(logo)
    const key = decodeURIComponent(url.pathname.replace(/^\/+/, ""))
    if (
      url.hostname.endsWith(".amazonaws.com") &&
      workspaceId &&
      (key.startsWith(`logos/${workspaceId}-`) ||
        key.startsWith(`workspace-logos/${workspaceId}/`))
    ) {
      return "/api/workspace/logo"
    }
  } catch {
    return logo
  }
  return logo
}
