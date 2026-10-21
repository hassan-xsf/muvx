import { redirect } from "next/navigation"
import { getSession } from "@/lib/dal"
import { IntegrationDetailClient } from "@/components/settings/integrations/detail"

export default async function IntegrationPlatformPage({
  params,
}: {
  params: Promise<{ platform: string }>
}) {
  const session = await getSession()
  if (!session?.user) redirect("/login")
  const tenantId = session.session.activeOrganizationId
  if (!tenantId) redirect("/onboarding")

  const { platform } = await params
  return <IntegrationDetailClient platformId={platform} />
}

export const instant = false
