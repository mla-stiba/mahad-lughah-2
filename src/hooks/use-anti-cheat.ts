'use client'

import { useEffect } from 'react'

// ============ ANTI-CHEAT HOOK (v2.7.0) ============
// FIX: balikin auto-refresh saat pindah tab/app DARI sesi tes
// - Saat visibilityState = 'hidden' (pindah tab/app) → logout + set flag
// - Saat visibilityState = 'visible' (balik ke tab) → reload → page.tsx detect refresh → auto-logout → login page
// - HANYA saat tes aktif (enabled=true), BUKAN di tab lain (materi, progres, dll)
// - Silent: gak ada toast, gak ada overlay

export function useAntiCheat(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return

    const handleContextMenu = (e: MouseEvent) => { e.preventDefault() }

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      const ctrl = e.ctrlKey || e.metaKey
      if (
        (ctrl && ['c', 'a', 's', 'p', 'u', 'x'].includes(key)) ||
        key === 'f12' ||
        (ctrl && e.shiftKey && ['i', 'j', 'c', 'k'].includes(key))
      ) {
        e.preventDefault()
        return false
      }
      if (key === 'printscreen' || (e.code && e.code === 'PrintScreen')) {
        try { navigator.clipboard?.writeText('') } catch {}
        return false
      }
    }

    const handleCopy = (e: ClipboardEvent) => { e.preventDefault() }
    const handleCut = (e: ClipboardEvent) => { e.preventDefault() }

    // FIX: auto-refresh + logout saat pindah tab/app (HANYA saat tes aktif)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // User pindah tab/app saat tes aktif → logout + set flag
        sessionStorage.setItem('anti-cheat-triggered', '1')
        fetch('/api/auth?action=logout', { method: 'POST', keepalive: true })
      } else if (document.visibilityState === 'visible') {
        // User balik ke tab → cek flag → reload (akan trigger auto-logout di page.tsx)
        if (sessionStorage.getItem('anti-cheat-triggered') === '1') {
          sessionStorage.removeItem('anti-cheat-triggered')
          window.location.reload()
        }
      }
    }

    // CSS disable text selection (minimal, gak bloat)
    const style = document.createElement('style')
    style.id = 'anti-cheat-style'
    style.textContent = `
      .anti-cheat-zone, .anti-cheat-zone * {
        user-select: none !important;
        -webkit-user-select: none !important;
        -webkit-touch-callout: none !important;
      }
      .anti-cheat-zone input, .anti-cheat-zone textarea {
        user-select: text !important;
      }
    `
    document.head.appendChild(style)

    document.addEventListener('contextmenu', handleContextMenu)
    document.addEventListener('keydown', handleKeyDown, true)
    document.addEventListener('copy', handleCopy)
    document.addEventListener('cut', handleCut)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu)
      document.removeEventListener('keydown', handleKeyDown, true)
      document.removeEventListener('copy', handleCopy)
      document.removeEventListener('cut', handleCut)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      style.remove()
    }
  }, [enabled])

  return { showOverlay: false }
}
