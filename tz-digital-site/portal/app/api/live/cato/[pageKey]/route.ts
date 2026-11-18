import { NextResponse } from 'next/server'
import { CATO_PROJECT_ID, readLivePage } from '@/lib/cato-live'
import { sitePage, siteProfile } from '@/lib/site-profiles'

export const dynamic = 'force-dynamic'

export async function GET(_request: Request, { params }: { params: Promise<{ pageKey: string }> }) {
  const { pageKey } = await params
  const profile = siteProfile('cato')!
  if (!sitePage(profile, pageKey)) return NextResponse.json({ error: 'Page not found' }, { status: 404 })
  try {
    const page = await readLivePage(CATO_PROJECT_ID, pageKey)
    const images = Object.fromEntries(Object.entries(page.images).map(([key, value]) => {
      const fileId = value.match(/\/files\/([0-9a-f-]{36})$/i)?.[1]
      return [key, fileId ? `https://tz-digital-client-portal.vercel.app/api/live/cato/image/${fileId}` : value]
    }))
    return NextResponse.json({ ...page, images }, { headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: 'Unable to load live content' }, { status: 500 })
  }
}
