import { NextRequest, NextResponse } from 'next/server'
import { randomBytes, randomInt } from 'node:crypto'
import { adminClient, userClient } from '@/lib/supabase'
import { projectSiteProfile } from '@/lib/project-site-profile'

const agencyRoles = ['agency_owner', 'agency_admin', 'agency_member']

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin')
  const host = request.headers.get('host')
  if (!origin || !host || new URL(origin).host !== host) return NextResponse.json({ error: 'Same-origin requests only' }, { status: 403 })
  const supabase = await userClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return NextResponse.json({ error: 'Sign in first' }, { status: 401 })
  const { data: membership } = await supabase.from('portal_memberships')
    .select('role').eq('user_id', auth.user.id).in('role', agencyRoles).limit(1).maybeSingle()
  if (!membership) return NextResponse.json({ error: 'Agency access required' }, { status: 403 })

  try {
    const body = await request.json()
    const clientName = typeof body.clientName === 'string' ? body.clientName.trim() : ''
    const projectName = typeof body.projectName === 'string' ? body.projectName.trim() : ''
    const siteMode = body.siteMode
    if (!clientName || clientName.length > 160) throw new Error('Enter a client name of 1–160 characters')
    if (!projectName || projectName.length > 160) throw new Error('Enter a project name of 1–160 characters')
    if (!['generic', 'cato', 'custom'].includes(siteMode)) throw new Error('Choose a site template')

    let siteKey: string | null = null
    let siteConfig: Record<string, unknown> = {}
    if (siteMode === 'cato') {
      siteKey = 'cato'
      siteConfig = { name: clientName + ' website' }
    } else if (siteMode === 'custom') {
      if (!body.siteConfig || typeof body.siteConfig !== 'object' || Array.isArray(body.siteConfig)) throw new Error('Enter a valid site profile JSON object')
      siteConfig = body.siteConfig as Record<string, unknown>
      siteKey = typeof siteConfig.key === 'string' ? siteConfig.key : null
      if (!siteKey || !projectSiteProfile(siteKey, siteConfig)) throw new Error('The site profile is missing required fields or contains invalid values')
    }

    const db = adminClient()
    let clientUserId: string | null = null
    let tenantId: string | null = null
    try {
      const loginId = await allocateLoginId(db)
      const password = randomBytes(24).toString('base64url')
      const email = 'client-' + randomBytes(20).toString('hex') + '@tz-digital.de'
      const { data: created, error: authError } = await db.auth.admin.createUser({
        email, password, email_confirm: true, app_metadata: { portal: true },
      })
      if (authError || !created.user) throw authError ?? new Error('Unable to create the client login')
      clientUserId = created.user.id

      const { data: tenant, error: tenantError } = await db.from('portal_tenants')
        .insert({ name: clientName }).select('id').single()
      if (tenantError || !tenant) throw tenantError ?? new Error('Unable to create the client organization')
      tenantId = tenant.id

      const { error: membershipsError } = await db.from('portal_memberships').insert([
        { tenant_id: tenantId, user_id: clientUserId, role: 'client_owner' },
        { tenant_id: tenantId, user_id: auth.user.id, role: membership.role },
      ])
      if (membershipsError) throw membershipsError

      const { error: loginError } = await db.from('portal_login_ids')
        .insert({ login_id: loginId, auth_user_id: clientUserId, auth_email: email })
      if (loginError) throw loginError

      const { data: project, error: projectError } = await db.from('portal_projects').insert({
        tenant_id: tenantId, name: projectName, service: 'website', site_key: siteKey, site_config: siteConfig,
        status: siteKey === 'cato' ? 'awaiting_client' : 'active',
        summary: 'Your website project and client review workspace.',
        next_milestone: 'Complete project intake',
      }).select('id').single()
      if (projectError || !project) throw projectError ?? new Error('Unable to create the client project')

      const tasks = [
        ['Confirm project details', 'client'],
        ['Share website copy and assets', 'client'],
        ['Prepare first website draft', 'agency'],
        ['Review the draft and leave feedback', 'shared'],
        ['Approve launch changes', 'shared'],
      ].map(([title, owner_type]) => ({ tenant_id: tenantId, project_id: project.id, title, owner_type, status: 'todo' }))
      const { error: tasksError } = await db.from('portal_tasks').insert(tasks)
      if (tasksError) throw tasksError

      const milestones = ['Project kickoff', 'Content and assets', 'First website draft', 'Client review', 'Launch'].map((title, position) => ({
        tenant_id: tenantId, project_id: project.id, title, position, status: position === 0 ? 'current' : 'upcoming',
      }))
      const { error: milestonesError } = await db.from('portal_milestones').insert(milestones)
      if (milestonesError) throw milestonesError

      return NextResponse.json({
        client: { id: tenantId, name: clientName },
        project: { id: project.id, name: projectName },
        invitation: { loginId, password },
      }, { status: 201 })
    } catch (error) {
      if (tenantId) await db.from('portal_tenants').delete().eq('id', tenantId)
      if (clientUserId) await db.auth.admin.deleteUser(clientUserId)
      throw error
    }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to create the client workspace' }, { status: 400 })
  }
}

async function allocateLoginId(db: ReturnType<typeof adminClient>) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const candidate = String(randomInt(0, 1_000_000)).padStart(6, '0')
    if (candidate === '146069' || candidate === '620314') continue
    const { data, error } = await db.from('portal_login_ids').select('login_id').eq('login_id', candidate).maybeSingle()
    if (error) throw error
    if (!data) return candidate
  }
  throw new Error('Unable to allocate a unique client login ID')
}
