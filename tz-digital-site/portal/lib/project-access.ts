import { userClient } from '@/lib/supabase'

export async function projectAccess(projectId: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(projectId)) return null
  const supabase = await userClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return null
  const { data: project } = await supabase.from('portal_projects').select('id, tenant_id, name, service').eq('id', projectId).maybeSingle()
  if (!project) return null
  const { data: membership } = await supabase.from('portal_memberships').select('role').eq('tenant_id', project.tenant_id).eq('user_id', auth.user.id).maybeSingle()
  if (!membership) return null
  return { supabase, project, role: membership.role, userId: auth.user.id,
    canEdit: ['agency_owner', 'agency_admin', 'agency_member', 'client_owner', 'client_editor'].includes(membership.role) }
}
