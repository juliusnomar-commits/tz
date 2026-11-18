-- Phase 1 follow-up: agency-only workflow metadata for individual feedback entries.
-- Apply with Supabase SQL editor after reviewing existing policies and backing up schema.
CREATE TABLE IF NOT EXISTS public.portal_feedback_triage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.portal_tenants(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.portal_projects(id) ON DELETE CASCADE,
  feedback_key text NOT NULL CHECK (char_length(feedback_key) BETWEEN 1 AND 255),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','in_progress','completed','needs_client')),
  internal_note text NOT NULL DEFAULT '' CHECK (char_length(internal_note) <= 4000),
  updated_by uuid REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, feedback_key)
);
CREATE INDEX IF NOT EXISTS portal_feedback_triage_tenant_status_idx ON public.portal_feedback_triage(tenant_id,status);
ALTER TABLE public.portal_feedback_triage ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS agency_feedback_triage_select ON public.portal_feedback_triage;
CREATE POLICY agency_feedback_triage_select ON public.portal_feedback_triage FOR SELECT TO authenticated
USING (EXISTS (
 SELECT 1 FROM public.portal_projects p JOIN public.portal_memberships m ON m.tenant_id = p.tenant_id
 WHERE p.id = project_id AND p.tenant_id = tenant_id AND m.user_id = auth.uid()
 AND m.role IN ('agency_owner','agency_admin','agency_member')
));
DROP POLICY IF EXISTS agency_feedback_triage_insert ON public.portal_feedback_triage;
CREATE POLICY agency_feedback_triage_insert ON public.portal_feedback_triage FOR INSERT TO authenticated
WITH CHECK (EXISTS (
 SELECT 1 FROM public.portal_projects p JOIN public.portal_memberships m ON m.tenant_id = p.tenant_id
 WHERE p.id = project_id AND p.tenant_id = tenant_id AND m.user_id = auth.uid()
 AND m.role IN ('agency_owner','agency_admin','agency_member')
));
DROP POLICY IF EXISTS agency_feedback_triage_update ON public.portal_feedback_triage;
CREATE POLICY agency_feedback_triage_update ON public.portal_feedback_triage FOR UPDATE TO authenticated
USING (EXISTS (
 SELECT 1 FROM public.portal_projects p JOIN public.portal_memberships m ON m.tenant_id = p.tenant_id
 WHERE p.id = project_id AND p.tenant_id = tenant_id AND m.user_id = auth.uid()
 AND m.role IN ('agency_owner','agency_admin','agency_member')
))
WITH CHECK (EXISTS (
 SELECT 1 FROM public.portal_projects p JOIN public.portal_memberships m ON m.tenant_id = p.tenant_id
 WHERE p.id = project_id AND p.tenant_id = tenant_id AND m.user_id = auth.uid()
 AND m.role IN ('agency_owner','agency_admin','agency_member')
));
