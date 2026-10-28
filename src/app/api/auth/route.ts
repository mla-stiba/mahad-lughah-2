import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// ============ AUTH API ============
// POST /api/auth?action=login-penguji    { username, password }
// POST /api/auth?action=login-mahasiswa  { kode }
// POST /api/auth?action=logout
// GET  /api/auth?action=me               (cookie session)

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action')

  // Logout tidak butuh body, handle dulu sebelum req.json()
  if (action === 'logout') {
    // Coba record logout event kalau ada session mahasiswa
    try {
      const sessionCookie = req.cookies.get('session')?.value
      if (sessionCookie) {
        const session = JSON.parse(sessionCookie)
        if (session.role === 'mahasiswa' && session.id) {
          await db.loginEvent.create({
            data: { mahasiswaId: session.id, type: 'logout' },
          }).catch(() => {})
        }
      }
    } catch {}
    const res = NextResponse.json({ success: true })
    res.cookies.delete('session')
    return res
  }

  // Parse body hanya untuk action yang butuh
  let body: any = {}
  try {
    body = await req.json()
  } catch {
    // Body kosong (mis. logout tanpa body) — sudah di-handle di atas
  }

  if (action === 'login-penguji') {
    const user = await db.user.findFirst({
      where: { username: body.username, password: body.password },
      select: { id: true, username: true, role: true, name: true },
    })
    if (!user) {
      return NextResponse.json({ error: 'Username atau password salah' }, { status: 401 })
    }
    const res = NextResponse.json({ role: 'penguji', user })
    res.cookies.set('session', JSON.stringify({ role: 'penguji', id: user.id, name: user.name }), {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
    })
    return res
  }

  if (action === 'login-mahasiswa') {
    const mhs = await db.mahasiswa.findUnique({
      where: { nim: body.kode || body.nim },
      include: { kamar: true },
    })
    if (!mhs) {
      return NextResponse.json({ error: 'Afwan NIM salah' }, { status: 401 })
    }
    // Password = tanggal lahir format DDMMYYYY
    if (mhs.tanggalLahir) {
      // Convert YYYY-MM-DD → DDMMYYYY
      const [year, month, day] = mhs.tanggalLahir.split('-')
      const expectedPassword = `${day}${month}${year}`
      if (body.password !== expectedPassword) {
        return NextResponse.json({ error: 'Afwan password salah' }, { status: 401 })
      }
    }
    // Record login event untuk tracking harian
    await db.loginEvent.create({
      data: { mahasiswaId: mhs.id, type: 'login' },
    }).catch(() => {}) // fail-safe: kalau tabel belum di-migrate, skip
    const res = NextResponse.json({ role: 'mahasiswa', mahasiswa: mhs })
    res.cookies.set('session', JSON.stringify({ role: 'mahasiswa', id: mhs.id, nim: mhs.nim, nama: mhs.nama }), {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
    })
    return res
  }

  if (action === 'change-password') {
    const { userId, oldPassword, newPassword } = body
    if (!userId || !oldPassword || !newPassword) {
      return NextResponse.json({ error: 'Field tidak lengkap' }, { status: 400 })
    }
    if (newPassword.length < 6) {
      return NextResponse.json({ error: 'Password baru minimal 6 karakter' }, { status: 400 })
    }
    const user = await db.user.findUnique({ where: { id: userId } })
    if (!user || user.password !== oldPassword) {
      return NextResponse.json({ error: 'Password lama salah' }, { status: 401 })
    }
    await db.user.update({
      where: { id: userId },
      data: { password: newPassword },
    })
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Action tidak dikenal' }, { status: 400 })
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action')

  if (action === 'me') {
    const sessionCookie = req.cookies.get('session')?.value
    if (!sessionCookie) return NextResponse.json({ user: null })
    try {
      const session = JSON.parse(sessionCookie)
      // Kalau mahasiswa, fetch data lengkap (kamar, dll) by id dari cookie.
      // Ini lebih hemat daripada frontend fetch /api/mahasiswa (semua mahasiswa) hanya untuk find by id.
      if (session.role === 'mahasiswa' && session.id) {
        const mhs = await db.mahasiswa.findUnique({
          where: { id: session.id },
          select: {
            id: true, nim: true, nama: true, wa: true, tanggalLahir: true,
            isKetuaKamar: true, kamarId: true,
            kamar: { select: { id: true, nama: true, gender: true } },
          },
        })
        if (!mhs) return NextResponse.json({ user: null })
        // Tetap bungkus di { mahasiswa: ... } supaya konsisten dengan struktur
        // yang sudah dipakai di page.tsx (session.mahasiswa?.nim, dll)
        return NextResponse.json({ user: { role: 'mahasiswa', id: mhs.id, nama: mhs.nama, mahasiswa: mhs } })
      }
      // Untuk penguji: fetch ulang dari DB supaya dapat username terbaru
      if (session.role === 'penguji' && session.id) {
        const user = await db.user.findUnique({
          where: { id: session.id },
          select: { id: true, username: true, name: true, role: true },
        })
        if (!user) return NextResponse.json({ user: null })
        // user.role sudah 'penguji' dari DB, jadi gak perlu override
        return NextResponse.json({ user: { ...user, id: user.id } })
      }
      return NextResponse.json({ user: session })
    } catch {
      return NextResponse.json({ user: null })
    }
  }

  return NextResponse.json({ error: 'Action tidak dikenal' }, { status: 400 })
}
