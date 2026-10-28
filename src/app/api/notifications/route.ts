import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// ============ NOTIFICATIONS API ============
// GET  /api/notifications?mahasiswaId=xxx
//      -> { data: Notification[] untuk mahasiswa tertentu + broadcast }
// GET  /api/notifications?action=unread-count&mahasiswaId=xxx
//      -> { data: { count } }
// POST /api/notifications?action=mark-read { notificationId }
//      -> mark as read
// POST /api/notifications?action=mark-all-read { mahasiswaId }
//      -> mark all read

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action')
  const mahasiswaId = searchParams.get('mahasiswaId')

  if (!mahasiswaId) {
    return NextResponse.json({ error: 'mahasiswaId required' }, { status: 400 })
  }

  if (action === 'unread-count') {
    const count = await db.notification.count({
      where: {
        OR: [
          { mahasiswaId, read: false },
          { mahasiswaId: null, read: false },
        ],
      },
    })
    return NextResponse.json({ data: { count } })
  }

  // Default: ambil semua notifikasi untuk mahasiswa + broadcast
  const notifications = await db.notification.findMany({
    where: {
      OR: [
        { mahasiswaId },
        { mahasiswaId: null }, // broadcast ke semua
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
  return NextResponse.json({ data: notifications })
}

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action')
  const body = await req.json()

  if (action === 'mark-read') {
    const { notificationId } = body
    if (!notificationId) {
      return NextResponse.json({ error: 'notificationId required' }, { status: 400 })
    }
    await db.notification.update({
      where: { id: notificationId },
      data: { read: true },
    })
    return NextResponse.json({ success: true })
  }

  if (action === 'mark-all-read') {
    const { mahasiswaId } = body
    if (!mahasiswaId) {
      return NextResponse.json({ error: 'mahasiswaId required' }, { status: 400 })
    }
    await db.notification.updateMany({
      where: {
        OR: [{ mahasiswaId }, { mahasiswaId: null }],
        read: false,
      },
      data: { read: true },
    })
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Action tidak dikenal' }, { status: 400 })
}
