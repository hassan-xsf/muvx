import { redirect } from "next/navigation"
import { getSession } from "@/lib/dal"
import { IntegrationsHubClient } from "@/components/settings/integrations"

export default async function IntegrationsPage() {
  const session = await getSession()
  if (!session?.user) redirect("/login")
  const tenantId = session.session.activeOrganizationId
  if (!tenantId) redirect("/onboarding")

  return <IntegrationsHubClient />
}

export const instant = false
