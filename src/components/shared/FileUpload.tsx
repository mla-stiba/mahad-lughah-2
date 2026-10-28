'use client'

import { useRef, useState } from 'react'
import { Upload, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface FileUploadProps {
  label: string
  accept: string
  value: string
  onChange: (url: string) => void
  preview?: 'image' | 'audio' | 'video' | 'none'
  maxMB?: number
}

export function FileUpload({ label, accept, value, onChange, preview = 'none', maxMB = 50 }: FileUploadProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const sizeMB = file.size / (1024 * 1024)
    if (sizeMB > maxMB) {
      setError(`File terlalu besar: ${sizeMB.toFixed(1)}MB. Max ${maxMB}MB.`)
      return
    }
    setError('')
    setUploading(true)

    try {
      // Upload ke server via API
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()
      if (res.ok && data.url) {
        onChange(data.url)
      } else {
        setError(data.error || 'Gagal upload')
      }
    } catch (err: any) {
      setError('Gagal upload: ' + err.message)
    } finally {
      setUploading(false)
    }
  }

  function clear() {
    onChange('')
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold uppercase tracking-wide text-gray-600 flex items-center gap-1">
        {label}
      </label>
      <div className="flex gap-2">
        <input
          ref={fileRef}
          type="file"
          accept={accept}
          onChange={handleFile}
          className="hidden"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="rounded-xl flex-1 justify-start text-xs"
        >
          {uploading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              Mengunggah...
            </>
            ) : value ? (
              <>
                <Upload className="w-3.5 h-3.5 mr-1.5" />
                Ganti file
              </>
            ) : (
              <>
                <Upload className="w-3.5 h-3.5 mr-1.5" />
                Pilih file upload
              </>
            )}
        </Button>
        {value && (
          <Button type="button" variant="ghost" size="sm" onClick={clear} className="rounded-xl text-rose-600 px-2">
            <X className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
      {/* URL input sebagai alternatif */}
      <input
        type="text"
        value={value.startsWith('/uploads/') || value.startsWith('data:') ? '' : value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Atau paste URL eksternal di sini..."
        className="w-full rounded-xl border px-3 py-1.5 text-xs"
      />
      {error && <p className="text-xs text-rose-600">{error}</p>}
      {/* Preview */}
      {value && preview === 'image' && (
        // FIX v3.0.5: auto-crop square 1:1 (sebelumnya max-h-24 yang tunjukin full image tanpa crop)
        <div className="aspect-square w-24 h-24 rounded-lg border overflow-hidden bg-gray-50">
          <img src={value} alt="preview" className="w-full h-full object-cover" />
        </div>
      )}
      {value && preview === 'audio' && (
        <audio controls src={value} className="w-full h-8" preload="none" />
      )}
      {value && preview === 'video' && (
        <video controls src={value} className="w-full max-h-32 rounded-lg" />
      )}
      {value && preview === 'none' && (
        <p className="text-xs text-emerald-600">✓ File terunggah</p>
      )}
    </div>
  )
}
