import { NextResponse } from 'next/server'

export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params
  if (!/^[a-z0-9][a-z0-9-]*\.(?:jpg|jpeg|png|webp)$/i.test(file)) {
    return new NextResponse('Invalid image', { status: 400 })
  }
  const response = await fetch(`https://cato-brown.vercel.app/images/${file}`, { next: { revalidate: 86400 } })
  if (!response.ok) return new NextResponse('Image unavailable', { status: 502 })
  const type = response.headers.get('content-type') ?? ''
  if (!type.startsWith('image/')) return new NextResponse('Invalid image response', { status: 502 })
  return new NextResponse(await response.arrayBuffer(), {
    headers: { 'Content-Type': type, 'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800' },
  })
}
