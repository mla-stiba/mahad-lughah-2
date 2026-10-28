'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { toast } from '@/hooks/use-toast'
import { Badge } from '@/components/shared'

export function PengaturanView({ session }: { session: any }) {
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function changePassword(e: React.FormEvent) {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      toast({ title: 'Konfirmasi password tidak cocok', variant: 'destructive' })
      return
    }
    if (newPassword.length < 6) {
      toast({ title: 'Password baru minimal 6 karakter', variant: 'destructive' })
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth?action=change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: session.id,
          oldPassword,
          newPassword,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        toast({ title: 'Password berhasil diubah', description: 'Silakan login kembali dengan password baru' })
        setOldPassword('')
        setNewPassword('')
        setConfirmPassword('')
      } else {
        toast({ title: 'Gagal', description: data.error, variant: 'destructive' })
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Pengaturan</h2>
        <p className="text-sm text-gray-500 mt-1">Akun admin & keamanan</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Informasi Akun</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center gap-3">
            <Label className="w-32">Nama:</Label>
            <span className="font-medium">{session.name}</span>
          </div>
          <div className="flex items-center gap-3">
            <Label className="w-32">Username:</Label>
            <span className="font-medium">{session.username}</span>
          </div>
          <div className="flex items-center gap-3">
            <Label className="w-32">Role:</Label>
            <Badge variant="success">Admin</Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ubah Password</CardTitle>
          <CardDescription>Aturan: minimal 6 karakter. Disarankan kombinasi huruf, angka, dan simbol.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={changePassword} className="space-y-3 max-w-md">
            <div className="space-y-2">
              <Label htmlFor="oldPassword">Password Lama</Label>
              <Input
                id="oldPassword"
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">Password Baru</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min. 6 karakter"
                required
                minLength={6}
              />
              {newPassword && newPassword.length < 6 && (
                <p className="text-xs text-rose-600">Password minimal 6 karakter</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Konfirmasi Password Baru</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Ulangi password baru"
                required
              />
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-rose-600">Konfirmasi tidak cocok</p>
              )}
            </div>
            <Button type="submit" disabled={loading || !oldPassword || !newPassword || !confirmPassword || newPassword !== confirmPassword} className="bg-emerald-600 hover:bg-emerald-700">
              {loading ? 'Memproses...' : 'Ubah Password'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bantuan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-gray-600">
          <p>• Setelah password diubah, Anda tetap login. Sistem pakai cookie session.</p>
          <p>• Jika lupa password admin, hubungi developer untuk reset via database langsung.</p>
          <p>• Mahasiswa login pakai NIM (tidak butuh password) — ini sengaja, agar mudah untuk ujian di lab.</p>
          <p>• Untuk keamanan lebih tinggi di produksi: pakai Supabase Auth dengan email + password + 2FA.</p>
        </CardContent>
      </Card>
    </div>
  )
}
