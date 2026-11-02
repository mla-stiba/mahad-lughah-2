'use client'

import { useState, useCallback } from 'react'

// ============ SSE STREAM READER UNTUK CSV IMPORT ============
// Helper hook untuk konsumsi SSE stream dari /api/import (POST).
// Endpoint kirim event: 'start' | 'progress' | 'done' | 'error'.
//
// Usage:
//   const { importWithProgress, progress, loading, error, result } = useCSVImport()
//   const ok = await importWithProgress('/api/import?action=mahasiswa', { csv: csvText })
//   if (ok) load()

export interface ImportProgress {
  phase?: 'create' | 'update'
  chunk?: number
  total?: number
  processed?: number
  created?: number
  updated?: number
  errors?: number
  total_rows?: number
  action?: string
}

export interface ImportResult {
  created: number
  updated: number
  errors: string[]
  total: number
  message?: string
}

export function useCSVImport() {
  const [progress, setProgress] = useState<ImportProgress | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)

  const importWithProgress = useCallback(
    async (url: string, body: any): Promise<boolean> => {
      setLoading(true)
      setError(null)
      setProgress(null)
      setResult(null)

      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })

        // Cek content-type — kalau JSON (action=reset/error), parse biasa
        const contentType = res.headers.get('content-type') || ''
        if (contentType.includes('application/json')) {
          const data = await res.json()
          if (res.ok) {
            setResult({
              created: 0,
              updated: 0,
              errors: [],
              total: 0,
              message: data.message || 'OK',
            })
            return true
          }
          setError(data.error || 'Gagal import')
          return false
        }

        // SSE stream
        if (!res.body) {
          setError('Tidak ada response body')
          return false
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let finalResult: ImportResult | null = null
        let streamError: string | null = null

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })

          // Parse complete SSE events (dipisahkan oleh \n\n)
          const events = buffer.split('\n\n')
          buffer = events.pop() || '' // sisanya simpan untuk chunk berikutnya

          for (const event of events) {
            if (!event.trim()) continue
            const lines = event.split('\n')
            let eventName = 'message'
            let dataStr = ''
            for (const line of lines) {
              if (line.startsWith('event: ')) eventName = line.slice(7).trim()
              else if (line.startsWith('data: ')) dataStr = line.slice(6)
            }
            if (!dataStr) continue
            try {
              const data = JSON.parse(dataStr)
              if (eventName === 'start') {
                setProgress({ total_rows: data.total, action: data.action, ...data })
              } else if (eventName === 'progress') {
                setProgress(data)
              } else if (eventName === 'done') {
                finalResult = {
                  created: data.created || 0,
                  updated: data.updated || 0,
                  errors: data.errors || [],
                  total: data.total || 0,
                  message: data.message,
                }
                setProgress((p) => ({
                  ...p,
                  ...data,
                  processed: data.created + data.updated,
                }))
              } else if (eventName === 'error') {
                streamError = data.message || 'Stream error'
              }
            } catch {
              // ignore parse error
            }
          }
        }

        if (streamError) {
          setError(streamError)
          return false
        }

        if (finalResult) {
          setResult(finalResult)
          return true
        }

        setError('Stream berakhir tanpa event done')
        return false
      } catch (e: any) {
        setError('Gagal import: ' + e.message)
        return false
      } finally {
        setLoading(false)
      }
    },
    []
  )

  const reset = useCallback(() => {
    setProgress(null)
    setLoading(false)
    setError(null)
    setResult(null)
  }, [])

  return { importWithProgress, progress, loading, error, result, reset }
}
