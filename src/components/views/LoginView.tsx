'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from '@/hooks/use-toast'
import { CheckCircle2, AlertCircle, Loader2, BookOpen, GraduationCap } from 'lucide-react'

const NIM_STORAGE_KEY = 'mla_last_nim'
const NIM_LENGTH = 10 // 10 digit

export function LoginView({ onLogin }: { onLogin: (session: any) => void }) {
  const [mode, setMode] = useState<'penguji' | 'mahasiswa'>('mahasiswa')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [nim, setNim] = useState('')
  const [mhsPassword, setMhsPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPwaPrompt, setShowPwaPrompt] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const [nimStatus, setNimStatus] = useState<'idle' | 'checking' | 'found' | 'notfound'>('idle')
  const [nimName, setNimName] = useState('')
  const nimDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load remembered NIM on mount
  useEffect(() => {
    const saved = localStorage.getItem(NIM_STORAGE_KEY)
    if (saved) {
      setNim(saved)
      validateNim(saved)
    }

    // PWA: offer pin to home screen after 3 seconds (first visit only)
    const pwaDismissed = localStorage.getItem('pwa_prompt_dismissed')
    if (!pwaDismissed) {
      const timer = setTimeout(() => setShowPwaPrompt(true), 3000)
      return () => clearTimeout(timer)
    }
  }, [])

  // PWA: request notification permission
  async function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      const result = await Notification.requestPermission()
      if (result === 'granted') {
        toast({ title: 'Notifikasi diaktifkan', description: 'Anda akan mendapat pengingat ujian' })
      }
    }
  }

  // PWA: install app (trigger saved beforeinstallprompt)
  async function installApp() {
    if (deferredPrompt) {
      deferredPrompt.prompt()
      const choice = await deferredPrompt.userChoice
      if (choice.outcome === 'accepted') {
        toast({ title: 'Aplikasi dipasang', description: 'Cek layar utama Anda' })
      }
      setDeferredPrompt(null)
      setShowPwaPrompt(false)
    } else {
      // iOS Safari — tidak support beforeinstallprompt, tampilkan instruksi manual
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
      if (isIOS) {
        toast({
          title: 'Cara Pasang di iOS',
          description: 'Tap tombol Share (kotak panah atas) → "Tambahkan ke Layar Utama"',
        })
      } else {
        toast({
          title: 'Pasang Aplikasi',
          description: 'Buka menu browser (⋮) → "Pasang aplikasi" / "Install app"',
        })
      }
    }
    requestNotificationPermission()
    localStorage.setItem('pwa_prompt_dismissed', 'true')
  }

  // Fullscreen mode (seperti game)
  async function toggleFullscreen() {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen()
        setIsFullscreen(true)
      } else {
        await document.exitFullscreen()
        setIsFullscreen(false)
      }
    } catch (e) {
      // iOS tidak support Fullscreen API, tapi PWA standalone mode sudah fullscreen
      toast({ title: 'Fullscreen tidak didukung', description: 'Pasang aplikasi ke layar utama untuk mode fullscreen' })
    }
  }

  // PWA: listen for beforeinstallprompt (save for later use)
  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShowPwaPrompt(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function validateNim(nim: string) {
    if (nim.length !== NIM_LENGTH) {
      setNimStatus('idle')
      setNimName('')
      return
    }
    setNimStatus('checking')
    try {
      const res = await fetch(`/api/mahasiswa?lookup-by-nim=${encodeURIComponent(nim)}`)
      const data = await res.json()
      const mhs = data.data
      if (mhs && mhs.nim === nim) {
        setNimStatus('found')
        setNimName(mhs.nama)
      } else {
        setNimStatus('notfound')
        setNimName('')
      }
    } catch (err) {
      // Skip console.error di production untuk bersihkan devtools
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.error('NIM lookup error:', err)
      }
      setNimStatus('idle')
    }
  }

  function handleNimChange(val: string) {
    const cleaned = val.replace(/\D/g, '').slice(0, NIM_LENGTH)
    setNim(cleaned)
    if (nimDebounceRef.current) clearTimeout(nimDebounceRef.current)
    nimDebounceRef.current = setTimeout(() => validateNim(cleaned), 300)
  }

  async function handleAdminLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/auth?action=login-penguji', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: 'Gagal login', description: data.error, variant: 'destructive' })
        return
      }
      // Auto fullscreen dinonaktifkan atas permintaan user
      // (sebelumnya: document.documentElement.requestFullscreen())
      onLogin({ role: 'penguji', id: data.user.id, username: data.user.username, name: data.user.name })
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  async function handleMahasiswaLogin(e: React.FormEvent) {
    e.preventDefault()
    if (nim.length !== NIM_LENGTH) {
      toast({ title: 'NIM harus 10 digit', variant: 'destructive' })
      return
    }
    if (nimStatus !== 'found') {
      toast({ title: 'Afwan NIM salah', description: 'NIM tidak ditemukan di database', variant: 'destructive' })
      return
    }
    if (!mhsPassword) {
      toast({ title: 'Password kosong', description: 'Isi password (tanggal lahir: DDMMYYYY)', variant: 'destructive' })
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth?action=login-mahasiswa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nim, password: mhsPassword }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: data.error || 'Login gagal', variant: 'destructive' })
        return
      }
      localStorage.setItem(NIM_STORAGE_KEY, nim)
      // Auto fullscreen dinonaktifkan atas permintaan user
      onLogin({ role: 'mahasiswa', mahasiswa: data.mahasiswa })
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-[oklch(0.97_0.012_230)]">
      {/* Decorative gradient orbs (IAI STIBA colors: navy + gold) */}
      <div className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full bg-blue-300/30 blur-3xl" />
      <div className="absolute -bottom-32 -left-32 w-[500px] h-[500px] rounded-full bg-amber-300/20 blur-3xl" />
      <div className="absolute top-1/3 left-1/2 w-72 h-72 rounded-full bg-emerald-200/20 blur-3xl" />

      {/* Subtle pattern overlay */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: 'radial-gradient(oklch(0.4 0.2 265) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
      }} />

      {/* Fullscreen toggle button — seperti game */}
      <button
        onClick={toggleFullscreen}
        className="fixed top-4 right-4 z-50 w-10 h-10 rounded-xl bg-white/80 backdrop-blur shadow-soft flex items-center justify-center hover:bg-white transition btn-press"
        title={isFullscreen ? 'Keluar Fullscreen' : 'Masuk Fullscreen'}
      >
        {isFullscreen ? (
          <svg className="w-5 h-5 text-gray-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M8 3v4a1 1 0 0 1-1 1H3M21 8h-4a1 1 0 0 1-1-1V3M3 16h4a1 1 0 0 1 1 1v4M16 21v-4a1 1 0 0 1 1-1h4" />
          </svg>
        ) : (
          <svg className="w-5 h-5 text-gray-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 8V5a2 2 0 0 1 2-2h3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M21 16v3a2 2 0 0 1-2 2h-3" />
          </svg>
        )}
      </button>

      <div className="relative min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* IAI STIBA Logo */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center mb-4 p-2 rounded-3xl bg-white shadow-float">
              {/* Logo IAI STIBA Makassar */}
              <img
                src="/branding/logo-berwarna-indo.png"
                alt="IAI STIBA Makassar"
                className="w-32 h-auto object-contain"
              />
            </div>
            <h1 className="text-3xl font-bold text-gradient-navy tracking-tight font-display">Ma'had Lughah</h1>
            <p className="text-sm font-semibold text-gray-700 mt-1.5">Pengembangan Bahasa Arab</p>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 mt-2 rounded-full bg-blue-50 border border-blue-200">
              <BookOpen className="w-3 h-3 text-blue-600" />
              <span className="text-xs font-medium text-blue-700">Ma&rsquo;had Lughah &middot; IAI STIBA Makassar</span>
            </div>
          </div>

          {/* Card */}
          <Card className="rounded-3xl shadow-float border-0 animate-pop-in">
            <CardHeader className="pb-3 pt-5">
              <CardTitle className="text-center text-lg font-display">Selamat Datang</CardTitle>
              <CardDescription className="text-center text-xs">Masuk sebagai...</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={mode} onValueChange={(v) => setMode(v as any)}>
                <TabsList className="grid w-full grid-cols-2 mb-5 rounded-2xl bg-gray-100 p-1 h-11">
                  <TabsTrigger value="penguji" className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-soft transition-all text-sm font-semibold">
                    <GraduationCap className="w-4 h-4 mr-1.5" /> Admin
                  </TabsTrigger>
                  <TabsTrigger value="mahasiswa" className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-soft transition-all text-sm font-semibold">
                    <BookOpen className="w-4 h-4 mr-1.5" /> Mahasiswa
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="penguji">
                  <form onSubmit={handleAdminLogin} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="username" className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Username</Label>
                      <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Masukkan username..." className="rounded-xl h-11" autoFocus />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="password" className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Password</Label>
                      <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••" className="rounded-xl h-11" />
                    </div>
                    <Button type="submit" className="w-full rounded-2xl h-12 bg-[oklch(0.50_0.18_265)] hover:bg-[oklch(0.45_0.18_265)] text-white font-bold text-base shadow-soft btn-press" disabled={loading}>
                      {loading ? 'Memproses...' : 'Masuk'}
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="mahasiswa">
                  <form onSubmit={handleMahasiswaLogin} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="nim" className="text-xs font-semibold text-gray-600 uppercase tracking-wide">NIM Mahasiswa</Label>
                      <div className="relative">
                        <Input
                          id="nim"
                          value={nim}
                          onChange={(e) => handleNimChange(e.target.value)}
                          placeholder="Masukkan NIM Anda..."
                          inputMode="numeric"
                          pattern="\d{10}"
                          maxLength={NIM_LENGTH}
                          className={`rounded-xl h-12 pr-10 font-mono tracking-wider text-base ${
                            nimStatus === 'found' ? 'border-emerald-400 focus-visible:ring-emerald-400 bg-emerald-50/30'
                            : nimStatus === 'notfound' ? 'border-rose-400 focus-visible:ring-rose-400 bg-rose-50/30'
                            : ''
                          }`}
                          autoFocus
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                          {nimStatus === 'checking' && <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />}
                          {nimStatus === 'found' && <CheckCircle2 className="w-6 h-6 text-emerald-600" />}
                          {nimStatus === 'notfound' && <AlertCircle className="w-6 h-5 text-rose-500" />}
                        </div>
                      </div>
                      <div className="min-h-[24px] text-xs">
                        {nimStatus === 'found' && (
                          <p className="text-emerald-700 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> {nimName}
                          </p>
                        )}
                        {nimStatus === 'notfound' && (
                          <p className="text-rose-600 font-semibold flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5" /> Afwan NIM salah
                          </p>
                        )}
                        {nimStatus === 'idle' && nim.length > 0 && nim.length < NIM_LENGTH && (
                          <p className="text-gray-400">{nim.length}/{NIM_LENGTH} digit — lengkapi 10 digit</p>
                        )}
                      </div>
                    </div>
                    {/* Password = tanggal lahir (DDMMYYYY) */}
                    <div className="space-y-1.5">
                      <Label htmlFor="mhsPassword" className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Password (tanggal lahir: DDMMYYYY)</Label>
                      <Input
                        id="mhsPassword"
                        type="password"
                        value={mhsPassword}
                        onChange={(e) => setMhsPassword(e.target.value.replace(/\D/g, '').slice(0, 8))}
                        placeholder="Mis. 15082003"
                        inputMode="numeric"
                        maxLength={8}
                        className="rounded-xl h-12 font-mono tracking-wider text-base"
                      />
                    </div>
                    <Button
                      type="submit"
                      className="w-full rounded-2xl h-12 bg-[oklch(0.50_0.18_265)] hover:bg-[oklch(0.45_0.18_265)] text-white font-bold text-base shadow-soft btn-press"
                      disabled={loading || nimStatus !== 'found' || !mhsPassword}
                    >
                      {loading ? 'Memproses...' : 'Masuk'}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <p className="text-center text-xs text-gray-400 mt-6 font-medium">
            &copy; {new Date().getFullYear()} Ma&rsquo;had Lughah &middot; IAI STIBA Makassar
          </p>
        </div>

        {/* PWA Install Prompt */}
        {showPwaPrompt && (
          <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 bg-white rounded-2xl shadow-float border border-gray-200 p-4 z-50 animate-pop-in">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-900">Pasang di Halaman Utama</p>
                <p className="text-xs text-gray-500 mt-1">Akses lebih cepat dengan menambahkan ke layar utama & aktifkan notifikasi untuk pengingat ujian</p>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={installApp}
                    className="text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg btn-press"
                  >
                    Izinkan & Pasang
                  </button>
                  <button
                    onClick={() => {
                      localStorage.setItem('pwa_prompt_dismissed', 'true')
                      setShowPwaPrompt(false)
                    }}
                    className="text-xs font-medium text-gray-500 hover:text-gray-700 px-3 py-1.5"
                  >
                    Nanti Saja
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
