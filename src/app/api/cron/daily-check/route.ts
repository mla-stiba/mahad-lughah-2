import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// ============ CRON JOB: DAILY CHECK ============
// Dipanggil oleh Vercel Cron setiap hari jam 6 pagi (WIB).
// Tugas:
// 1. Cek mahasiswa yang belum login hari kemarin (atau belum lihat materi terbaru)
// 2. Buat Notification record untuk ketua kamar yang anggotanya belum aktif
// 3. Cek ujian yang akan mulai dalam 2 jam, 1 jam, 30 menit → buat Notification untuk peserta
// 4. Cek materi baru yang dirilis hari ini → buat Notification "materi_baru"
//
// AUTH: Cron endpoint wajib pakai CRON_SECRET env var (Vercel best practice)
// https://vercel.com/docs/cron-jobs#securing-cron-jobs

export async function GET(req: NextRequest) {
  // Auth check
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const endOfToday = new Date()
  endOfToday.setHours(23, 59, 59, 999)

  const results: any = {
    timestamp: now.toISOString(),
    ketuaAlerts: 0,
    ujianReminders: 0,
    materiBaruNotifs: 0,
  }

  try {
    // ===== 1. KETUA ALERT: anggota belum login hari ini =====
    // Ambil semua ketua kamar
    const ketuas = await db.mahasiswa.findMany({
      where: { isKetuaKamar: true },
      select: {
        id: true, nama: true,
        kamar: { select: { id: true, nama: true } },
      },
    })

    for (const ketua of ketuas) {
      // Cek anggota kamar ini yang belum login hari ini
      const loginToday = await db.loginEvent.findMany({
        where: {
          type: 'login',
          timestamp: { gte: startOfToday },
          mahasiswa: { kamarId: ketua.kamar.id },
        },
        select: { mahasiswaId: true },
        distinct: ['mahasiswaId'],
      })
      const loggedInIds = new Set(loginToday.map(l => l.mahasiswaId))
      const anggotaBelumLogin = await db.mahasiswa.findMany({
        where: {
          kamarId: ketua.kamar.id,
          id: { notIn: Array.from(loggedInIds) },
        },
        select: { id: true, nama: true, nim: true },
      })

      if (anggotaBelumLogin.length > 0) {
        // Buat notification untuk ketua kamar
        await db.notification.create({
          data: {
            mahasiswaId: ketua.id,
            type: 'ketua_alert',
            title: `${anggotaBelumLogin.length} anggota belum login hari ini`,
            body: `Anggota kamar ${ketua.kamar.nama} yang belum login: ${anggotaBelumLogin.map(a => a.nama).join(', ')}. Ingatkan mereka untuk login dan lihat materi hari ini.`,
            metadata: JSON.stringify({
              kamarId: ketua.kamar.id,
              kamarNama: ketua.kamar.nama,
              belumLoginNim: anggotaBelumLogin.map(a => a.nim),
              type: 'belum_login_harian',
            }),
          },
        })
        results.ketuaAlerts++
      }
    }

    // ===== 2. UJIAN REMINDER: 2 jam / 1 jam / 30 menit sebelum mulai =====
    // Ambil sesi yang aktif + punya jamMulai hari ini
    const sesiAktif = await db.sesiUjian.findMany({
      where: {
        aktif: true,
        tanggalMulai: { gte: startOfToday, lte: endOfToday },
        jamMulai: { not: null },
      },
      select: {
        id: true, nama: true, jamMulai: true, tanggalMulai: true,
        levelId: true, level: { select: { nama: true } },
      },
    })

    for (const sesi of sesiAktif) {
      if (!sesi.jamMulai) continue
      // Parse jamMulai (format "HH:MM")
      const [hours, minutes] = sesi.jamMulai.split(':').map(Number)
      const sesiStart = new Date(sesi.tanggalMulai)
      sesiStart.setHours(hours || 0, minutes || 0, 0, 0)
      const diffMs = sesiStart.getTime() - now.getTime()
      const diffMinutes = Math.floor(diffMs / 60000)

      // Trigger reminder pada milestone: 120, 60, 30 menit sebelum
      const milestones = [120, 60, 30]
      for (const milestone of milestones) {
        // Trigger kalau diff dalam rentang [milestone-5, milestone+5]
        if (diffMinutes >= milestone - 5 && diffMinutes <= milestone + 5) {
          // Cek apakah reminder untuk milestone ini sudah dibuat (hindari duplikat)
          const existing = await db.notification.findFirst({
            where: {
              type: 'ujian_reminder',
              metadata: { contains: sesi.id },
              createdAt: { gte: new Date(now.getTime() - 10 * 60 * 1000) }, // 10 menit terakhir
            },
          })
          if (existing) continue

          // Buat notifikasi untuk semua mahasiswa (broadcast)
          await db.notification.create({
            data: {
              mahasiswaId: null, // broadcast ke semua
              type: 'ujian_reminder',
              title: `⏰ Tes "${sesi.nama}" mulai dalam ${milestone} menit`,
              body: `Sesi ujian "${sesi.nama}" (${sesi.level?.nama || ''}) akan dimulai pukul ${sesi.jamMulai}. Siapkan diri Anda.`,
              metadata: JSON.stringify({
                sesiId: sesi.id,
                sesiNama: sesi.nama,
                jamMulai: sesi.jamMulai,
                milestone,
                type: 'ujian_reminder',
              }),
            },
          })
          results.ujianReminders++
        }
      }
    }

    // ===== 3. MATERI BARU NOTIFICATION =====
    // Materi yang dirilis hari ini (tanggalRilis di rentang hari ini)
    const materiBaru = await db.materi.findMany({
      where: {
        tanggalRilis: { gte: startOfToday, lte: endOfToday },
      },
      select: { id: true, arabic: true, arti: true, jenis: true, kategori: true },
    })

    for (const m of materiBaru) {
      // Cek apakah notifikasi materi ini sudah dibuat
      const existing = await db.notification.findFirst({
        where: {
          type: 'materi_baru',
          metadata: { contains: m.id },
          createdAt: { gte: startOfToday },
        },
      })
      if (existing) continue

      await db.notification.create({
        data: {
          mahasiswaId: null,
          type: 'materi_baru',
          title: `📚 Materi baru: ${m.arti}`,
          body: `Materi ${m.jenis === 'mufrodat' ? 'mufrodat' : 'tarkib'} baru dirilis: ${m.arabic} — ${m.arti}${m.kategori ? ` (kategori: ${m.kategori})` : ''}. Yuk lihat dan hafalkan!`,
          metadata: JSON.stringify({
            materiId: m.id,
            arabic: m.arabic,
            arti: m.arti,
            jenis: m.jenis,
            type: 'materi_baru',
          }),
        },
      })
      results.materiBaruNotifs++
    }

    return NextResponse.json({
      success: true,
      ...results,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
