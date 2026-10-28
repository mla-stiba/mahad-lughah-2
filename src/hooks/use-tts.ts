'use client'

import { useState, useEffect, useCallback } from 'react'

// ============ TTS ARABIC (Web Speech API) ============
// Pakai Web Speech API (browser native, gratis, no API key)
// Filter voice dengan lang.startsWith('ar') untuk dapat Arabic voice
//
// Browser support: Chrome 33+, Safari iOS7+, Firefox 49+, Edge
// Voice availability tergantung OS installed voices (Android/iOS/macOS punya native Arabic voice)
//
// Limit play count untuk anti-cheat (mis. max 2x play per soal)
// Sumber: https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis

export function useTTS() {
  const [supported, setSupported] = useState(false)
  const [arabicVoices, setArabicVoices] = useState<SpeechSynthesisVoice[]>([])
  const [speaking, setSpeaking] = useState(false)
  const [playCount, setPlayCount] = useState(0)
  const [maxPlay, setMaxPlay] = useState(2)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('speechSynthesis' in window)) return
    setSupported(true)

    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices()
      // Filter Arabic voice (ar-SA, ar-EG, ar-AE, dll)
      const arabic = voices.filter(v => v.lang.startsWith('ar'))
      setArabicVoices(arabic)
    }

    loadVoices()
    // Voices async loaded — listen event
    window.speechSynthesis.onvoiceschanged = loadVoices
    return () => {
      window.speechSynthesis.cancel()
    }
  }, [])

  const speak = useCallback((text: string, opts?: { rate?: number; pitch?: number; onEnd?: () => void }) => {
    if (!supported || !text) return
    if (playCount >= maxPlay) return  // limit anti-cheat

    // Cancel ongoing speech
    window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'ar-SA'  // default Arabic Saudi
    // Pilih voice Arabic pertama yang available
    if (arabicVoices.length > 0) {
      utterance.voice = arabicVoices[0]
    }
    utterance.rate = opts?.rate ?? 0.75  // slower for learning
    utterance.pitch = opts?.pitch ?? 1
    utterance.onstart = () => setSpeaking(true)
    utterance.onend = () => {
      setSpeaking(false)
      opts?.onEnd?.()
    }
    utterance.onerror = () => setSpeaking(false)

    window.speechSynthesis.speak(utterance)
    setPlayCount(c => c + 1)
  }, [supported, arabicVoices, playCount, maxPlay])

  const stop = useCallback(() => {
    if (!supported) return
    window.speechSynthesis.cancel()
    setSpeaking(false)
  }, [supported])

  const resetCount = useCallback((max?: number) => {
    setPlayCount(0)
    if (max) setMaxPlay(max)
  }, [])

  return { supported, arabicVoices, speaking, playCount, maxPlay, speak, stop, resetCount }
}
