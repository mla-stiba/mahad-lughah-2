'use client'

import { useState, useEffect, Suspense } from 'react'
import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/shared'
import { toast } from '@/hooks/use-toast'
import {
  LayoutDashboard, Users, BookOpen, FileText, BarChart3,
  User, GraduationCap, LogOut, Settings,
  ChevronDown, ClipboardList,
} from 'lucide-react'

// ============ LAZY LOAD VIEWS ============
// Setiap view jadi chunk JS terpisah. Browser hanya download kode view
// yang user buka, BUKAN semua 11 views sekaligus.
// Dampak: initial bundle -/+ 60-70% lebih kecil, sangat penting untuk HP low-end.

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 border-4 border-gray-200 border-t-emerald-600 rounded-full animate-spin" />
    </div>
  )
}

const LoginView = dynamic(() => import('@/components/views/LoginView').then(m => ({ default: m.LoginView })), {
  loading: () => <PageLoader />,
})
const DashboardView = dynamic(() => import('@/components/views/DashboardView').then(m => ({ default: m.DashboardView })), {
  loading: () => <PageLoader />,
})
const MahasiswaView = dynamic(() => import('@/components/views/MahasiswaView').then(m => ({ default: m.MahasiswaView })), {
  loading: () => <PageLoader />,
})
const MateriView = dynamic(() => import('@/components/views/MateriView').then(m => ({ default: m.MateriView })), {
  loading: () => <PageLoader />,
})
const SesiView = dynamic(() => import('@/components/views/SesiView').then(m => ({ default: m.SesiView })), {
  loading: () => <PageLoader />,
})
const HasilView = dynamic(() => import('@/components/views/HasilView').then(m => ({ default: m.HasilView })), {
  loading: () => <PageLoader />,
})
const PerMahasiswaView = dynamic(() => import('@/components/views/PerMahasiswaView').then(m => ({ default: m.PerMahasiswaView })), {
  loading: () => <PageLoader />,
})
const UjianView = dynamic(() => import('@/components/views/UjianView').then(m => ({ default: m.UjianView })), {
  loading: () => <PageLoader />,
})
const ProgressView = dynamic(() => import('@/components/views/ProgressView').then(m => ({ default: m.ProgressView })), {
  loading: () => <PageLoader />,
})
const MainPageMahasiswa = dynamic(() => import('@/components/views/MainPageMahasiswa').then(m => ({ default: m.MainPageMahasiswa })), {
  loading: () => <PageLoader />,
})
const MateriMahasiswaView = dynamic(() => import('@/components/views/MateriMahasiswaView').then(m => ({ default: m.MateriMahasiswaView })), {
  loading: () => <PageLoader />,
})
const PengaturanView = dynamic(() => import('@/components/views/PengaturanView').then(m => ({ default: m.PengaturanView })), {
  loading: () => <PageLoader />,
})
const KetuaKamarView = dynamic(() => import('@/components/views/KetuaKamarView').then(m => ({ default: m.KetuaKamarView })), {
  loading: () => <PageLoader />,
})
const KegiatanView = dynamic(() => import('@/components/views/KegiatanView').then(m => ({ default: m.KegiatanView })), {
  loading: () => <PageLoader />,
})

type View = 'dashboard' | 'mahasiswa' | 'materi' | 'sesi' | 'hasil' | 'per-mahasiswa' | 'ujian' | 'progress' | 'pengaturan' | 'materi-mahasiswa' | 'ketua-kamar' | 'kegiatan'

export default function Home() {
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [activeView, setActiveView] = useState<View>('dashboard')

  useEffect(() => {
    // FIX #7: Refresh di laman mahasiswa → auto-logout
    // Cek apakah ini refresh (navigation type reload) atau new navigation
    const navEntries = performance.getEntriesByType('navigation') as any[]
    const isRefresh = navEntries.length > 0 && navEntries[0].type === 'reload'

    fetch('/api/auth?action=me')
      .then(r => r.json())
      .then(d => {
        if (d.user) {
          // Kalau refresh + role mahasiswa → auto-logout
          // Penguji/admin tetap login saat refresh
          if (isRefresh && (d.user.role === 'mahasiswa' || d.user.mahasiswa?.role === 'mahasiswa')) {
            fetch('/api/auth?action=logout', { method: 'POST' }).finally(() => {
              setSession(null)
              setLoading(false)
            })
          } else {
            setSession(d.user)
            setLoading(false)
          }
        } else {
          setLoading(false)
        }
      })
      .catch(() => setLoading(false))
  }, [])

  // FIX #6: Anti-cheat saat ujian aktif — lock (overlay hitam) saat pindah tab/app
  // Tapi gak auto-logout (cuma lock konten supaya gak kelihatan)
  // beforeunload tetap logout mahasiswa kalau tutup tab/refresh
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (session?.role === 'mahasiswa' || session?.mahasiswa?.role === 'mahasiswa') {
        fetch('/api/auth?action=logout', { method: 'POST', keepalive: true })
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [session])

  async function logout() {
    await fetch('/api/auth?action=logout', { method: 'POST' })
    setSession(null)
    setActiveView('dashboard')
    toast({ title: 'Berhasil logout' })
  }

  function handleLogin(s: any) {
    setSession(s)
    // FIX #5: hapus Beranda — mahasiswa langsung ke Ujian
    if (s.role === 'penguji' || s.role === 'admin') {
      setActiveView('dashboard')
    } else {
      setActiveView('ujian')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="w-10 h-10 border-4 border-gray-200 border-t-emerald-600 rounded-full animate-spin" />
      </div>
    )
  }

  if (!session) {
    return <LoginView onLogin={handleLogin} />
  }

  // === ADMIN LAYOUT: Dark sidebar (Linear/Vercel-style) ===
  // FIX #1: terima role 'penguji' ATAU 'admin' (User.role bisa keduanya di schema)
  // Kalau cuma 'penguji' yang dicek, role 'admin' jatuh ke layout mahasiswa → halaman kosong
  if (session.role === 'penguji' || session.role === 'admin') {
    const navItems: { id: View; label: string; icon: React.ReactNode; group: string }[] = [
      { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-[18px] h-[18px]" />, group: 'Menu' },
      { id: 'mahasiswa', label: 'Data Mahasiswa', icon: <Users className="w-[18px] h-[18px]" />, group: 'Menu' },
      { id: 'materi', label: 'Materi Hafalan', icon: <BookOpen className="w-[18px] h-[18px]" />, group: 'Menu' },
      { id: 'sesi', label: 'Sesi Tes', icon: <FileText className="w-[18px] h-[18px]" />, group: 'Menu' },
      { id: 'hasil', label: 'Hasil & Analisis', icon: <BarChart3 className="w-[18px] h-[18px]" />, group: 'Menu' },
      { id: 'kegiatan', label: 'Kegiatan', icon: <BookOpen className="w-[18px] h-[18px]" />, group: 'Menu' },
      { id: 'per-mahasiswa', label: 'Evaluasi', icon: <User className="w-[18px] h-[18px]" />, group: 'Menu' },
      { id: 'pengaturan', label: 'Pengaturan', icon: <Settings className="w-[18px] h-[18px]" />, group: 'Lainnya' },
    ]

    const groupedNav = navItems.reduce((acc, item) => {
      if (!acc[item.group]) acc[item.group] = []
      acc[item.group].push(item)
      return acc
    }, {} as Record<string, typeof navItems>)

    return (
      <div className="min-h-screen bg-background flex">
        {/* Sidebar (dark, desktop) */}
        <aside className="hidden lg:flex flex-col w-64 sticky top-0 h-screen bg-sidebar text-sidebar-foreground no-print">
          {/* Logo IAI STIBA */}
          <div className="px-5 py-4 border-b border-sidebar-border">
            <div className="flex items-center gap-2.5">
              <img
                src="/branding/logo-putih-indo.png"
                alt="IAI STIBA Makassar"
                className="w-9 h-auto object-contain"
              />
              <div>
                <h1 className="font-bold text-white text-sm leading-tight font-display">Ma'had Lughah</h1>
                <p className="text-[10px] text-amber-300 mt-0.5 font-semibold">Pengembangan Bahasa Arab</p>
              </div>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 overflow-y-auto py-3 px-3 scroll-thin">
            {Object.entries(groupedNav).map(([group, items]) => (
              <div key={group} className="mb-4">
                <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500">{group}</p>
                {items.map(item => (
                  <button
                    key={item.id}
                    onClick={() => setActiveView(item.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all mb-0.5 ${
                      activeView === item.id
                        ? 'sidebar-item-active'
                        : 'text-gray-400 hover:bg-sidebar-accent hover:text-white'
                    }`}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            ))}
          </nav>

          {/* User footer */}
          <div className="px-3 py-3 border-t border-sidebar-border">
            <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-sidebar-accent transition cursor-pointer" onClick={() => setActiveView('pengaturan')}>
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-white text-xs font-bold">
                {session.name?.charAt(0) || 'A'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{session.name}</p>
                <p className="text-[11px] text-gray-400 truncate">@{session.username}</p>
              </div>
              <ChevronDown className="w-4 h-4 text-gray-500" />
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-h-screen flex flex-col">
          {/* Top bar */}
          <header className="bg-white border-b border-gray-200 px-4 lg:px-8 py-3 flex items-center justify-between no-print sticky top-0 z-10">
            {/* Mobile brand with IAI STIBA logo */}
            <div className="lg:hidden flex items-center gap-2.5">
              <img
                src="/branding/logo-berwarna-indo.png"
                alt="IAI STIBA"
                className="w-9 h-auto object-contain"
              />
              <div>
                <h1 className="font-bold text-gray-900 text-sm font-display">Ma'had Lughah</h1>
                <p className="text-[10px] text-gray-500">Admin Panel</p>
              </div>
            </div>

            {/* FIX #3: hapus search bar + notifikasi (gak berguna) */}
            <div className="flex-1" />

            <div className="flex items-center gap-2">
              {/* FIX v2.9.8: profil admin (desktop) + tombol Pengaturan (mobile & desktop).
                  User minta: tombol Pengaturan pindah dekat nama admin (sebelumnya di mobile
                  bottom nav, gak muat 6 item — Kegiatan jadi gak muncul). */}
              <div className="hidden lg:flex items-center gap-2 px-3 h-10 rounded-xl bg-gray-100">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-white text-xs font-bold">
                  {session.name?.charAt(0) || 'A'}
                </div>
                <span className="text-sm font-medium text-gray-700">{session.name}</span>
              </div>
              {/* Mobile: tampilkan avatar+nama compact + tombol Pengaturan */}
              <button
                onClick={() => setActiveView('pengaturan' as View)}
                className={`lg:hidden flex items-center gap-2 px-2.5 h-9 rounded-xl ${activeView === 'pengaturan' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-700'}`}
                title="Pengaturan"
                aria-label="Pengaturan"
              >
                <Settings className="w-4 h-4" />
                <span className="text-xs font-medium hidden sm:inline">{session.name?.split(' ')[0]}</span>
              </button>
              {/* Desktop: tombol Pengaturan outline di kanan nama admin */}
              <button
                onClick={() => setActiveView('pengaturan' as View)}
                className={`hidden lg:flex items-center gap-1.5 px-3 h-10 rounded-xl text-sm font-medium transition ${activeView === 'pengaturan' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'text-gray-600 hover:bg-gray-100'}`}
                title="Pengaturan"
              >
                <Settings className="w-4 h-4" />
                <span>Pengaturan</span>
              </button>
              <Button size="sm" variant="ghost" onClick={logout} className="rounded-xl text-gray-600 hover:text-rose-600 hover:bg-rose-50 h-10 w-10 p-0">
                <LogOut className="w-4.5 h-4.5" />
              </Button>
            </div>
          </header>

          {/* Content */}
          <div className="flex-1 p-4 lg:p-8 max-w-7xl mx-auto w-full">
            {activeView === 'dashboard' && <DashboardView />}
            {activeView === 'mahasiswa' && <MahasiswaView />}
            {activeView === 'materi' && <MateriView />}
            {activeView === 'sesi' && <SesiView />}
            {activeView === 'hasil' && <HasilView />}
            {activeView === 'kegiatan' && <KegiatanView />}
            {activeView === 'per-mahasiswa' && <PerMahasiswaView />}
            {activeView === 'pengaturan' && <PengaturanView session={session} />}
          </div>

          {/* Mobile bottom navigation */}
          <nav className="lg:hidden fixed bottom-0 left-0 right-0 bottom-nav z-30 no-print border-t border-white/5">
            <div className="grid grid-cols-6 px-1 py-2 gap-0.5">
              {/* FIX v2.9.8: mobile bottom nav — ganti 'Atur' (Pengaturan) dengan 'Kegiatan'.
                  Tombol Pengaturan pindah ke header (dekat nama admin) supaya 6 slot
                  bottom nav cukup untuk: Home, Data, Materi, Tes, Hasil, Kegiatan. */}
              {[
                { id: 'dashboard', label: 'Home', icon: <LayoutDashboard className="w-5 h-5" /> },
                { id: 'mahasiswa', label: 'Data', icon: <Users className="w-5 h-5" /> },
                { id: 'materi', label: 'Materi', icon: <BookOpen className="w-5 h-5" /> },
                { id: 'sesi', label: 'Tes', icon: <FileText className="w-5 h-5" /> },
                { id: 'hasil', label: 'Hasil', icon: <BarChart3 className="w-5 h-5" /> },
                { id: 'kegiatan', label: 'Kegiatan', icon: <ClipboardList className="w-5 h-5" /> },
              ].map(item => (
                <button
                  key={item.id}
                  onClick={() => setActiveView(item.id as View)}
                  className={`flex flex-col items-center justify-center py-1.5 ${activeView === item.id ? 'bottom-nav-active' : 'text-gray-500'}`}
                >
                  {item.icon}
                  <span className="text-[9px] mt-0.5 font-medium">{item.label}</span>
                </button>
              ))}
            </div>
          </nav>
          <div className="lg:hidden h-16" />
        </main>
      </div>
    )
  }

  // === MAHASISWA LAYOUT ===
  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between no-print">
        <div className="flex items-center gap-3">
          <img
            src="/branding/logo-berwarna-indo.png"
            alt="IAI STIBA"
            className="w-10 h-auto object-contain"
          />
          <div>
            <h1 className="font-bold text-gray-900 text-sm font-display">Ma'had Lughah</h1>
            <p className="text-[10px] text-gray-500">Laman Mahasiswa</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="info">{session.mahasiswa?.nim}</Badge>
          {/* Desktop tabs — fix bug #12: Progress view tidak muncul di desktop */}
          <div className="hidden lg:flex items-center gap-1 ml-2">
            {[
              { id: 'ujian' as View, label: 'Tes', icon: <FileText className="w-4 h-4" /> },
              { id: 'materi-mahasiswa' as View, label: 'Materi', icon: <BookOpen className="w-4 h-4" /> },
              { id: 'progress' as View, label: 'Progres', icon: <GraduationCap className="w-4 h-4" /> },
              ...(session.mahasiswa?.isKetuaKamar
                ? [{ id: 'ketua-kamar' as View, label: 'Kamar Saya', icon: <Users className="w-4 h-4" /> }]
                : []),
            ].map(item => (
              <button
                key={item.id}
                onClick={() => setActiveView(item.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  activeView === item.id ? 'bg-emerald-100 text-emerald-700' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>
          <Button size="sm" variant="ghost" onClick={logout} className="rounded-xl h-9 w-9 p-0">
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* Hero greeting card — IAI STIBA Navy + Gold */}
      <div className="bg-gradient-to-br from-[oklch(0.35_0.14_265)] to-[oklch(0.25_0.06_265)] text-white px-4 py-6 lg:px-8 relative overflow-hidden">
        {/* Decorative gold orb */}
        <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-amber-400/20 blur-3xl" />
        <div className="absolute -bottom-12 -left-12 w-48 h-48 rounded-full bg-amber-400/15 blur-3xl" />
        <div className="max-w-3xl mx-auto flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur flex items-center justify-center text-2xl font-bold border-2 border-white/30">
            {session.mahasiswa?.nama?.charAt(0) || 'M'}
          </div>
          <div>
            <p className="text-white/80 text-sm">Assalamualaikum,</p>
            <p className="text-xl font-bold">{session.mahasiswa?.nama}</p>
            <p className="text-white/80 text-xs mt-0.5">{session.mahasiswa?.kamar?.nama}{session.mahasiswa?.isKetuaKamar ? ' · Ketua' : ''}</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="px-4 lg:px-8 py-6 max-w-3xl mx-auto pb-20 lg:pb-8">
        {/* FIX #5: Hapus Beranda — mahasiswa langsung ke Ujian */}
        {activeView === 'ujian' && <UjianView session={session} />}
        {activeView === 'materi-mahasiswa' && <MateriMahasiswaView session={session} />}
        {activeView === 'progress' && <ProgressView session={session} />}
        {activeView === 'ketua-kamar' && <KetuaKamarView session={session} />}
      </main>

      {/* Mobile bottom nav */}
      {/* FIX #2: tambah conditional 'Kamar Saya' untuk ketua kamar (isKetuaKamar=true) */}
      {/* FIX #1 (re-fix): pakai pure inline style (display:grid + gridTemplateColumns)
          supaya gak tergantung Tailwind purge untuk dynamic class grid-cols-${N} */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bottom-nav z-30 no-print border-t border-white/5">
        {(() => {
          const baseNav = [
            { id: 'ujian' as View, label: 'Tes', icon: <FileText className="w-5 h-5" /> },
            { id: 'materi-mahasiswa' as View, label: 'Materi', icon: <BookOpen className="w-5 h-5" /> },
            { id: 'progress' as View, label: 'Progres', icon: <GraduationCap className="w-5 h-5" /> },
          ]
          const ketuaNav = session.mahasiswa?.isKetuaKamar
            ? [{ id: 'ketua-kamar' as View, label: 'Kamar', icon: <Users className="w-5 h-5" /> }]
            : []
          // Urutan: Beranda, Ujian, Materi, Kamar (kalau ketua), Progres
          const navItems = session.mahasiswa?.isKetuaKamar
            ? [...baseNav.slice(0, 3), ...ketuaNav, ...baseNav.slice(3)]
            : baseNav
          const colCount = navItems.length
          return (
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))`, padding: '8px 4px' }}>
              {navItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => setActiveView(item.id as View)}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '8px 2px', background: 'transparent', border: 'none', cursor: 'pointer' }}
                  className={activeView === item.id ? 'bottom-nav-active' : 'text-gray-500'}
                >
                  {item.icon}
                  <span style={{ fontSize: '10px', marginTop: '4px', fontWeight: 500 }}>{item.label}</span>
                </button>
              ))}
            </div>
          )
        })()}
      </nav>
      <div className="lg:hidden h-16" />
    </div>
  )
}
