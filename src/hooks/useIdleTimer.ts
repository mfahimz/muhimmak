"use client"

import { useEffect, useRef } from "react"

interface UseIdleTimerProps {
  timeoutMs: number       // e.g. 90000 (90 seconds)
  warningMs: number       // e.g. 10000 (10 seconds warning)
  onWarning: () => void
  onTimeout: () => void
  onReset: () => void
  enabled: boolean
}

export function useIdleTimer({
  timeoutMs,
  warningMs,
  onWarning,
  onTimeout,
  onReset,
  enabled
}: UseIdleTimerProps) {
  const timeoutTimerRef = useRef<NodeJS.Timeout | null>(null)
  const warningTimerRef = useRef<NodeJS.Timeout | null>(null)
  const isWarningActiveRef = useRef(false)

  const clearTimers = () => {
    if (timeoutTimerRef.current) clearTimeout(timeoutTimerRef.current)
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current)
  }

  const resetTimer = () => {
    if (!enabled) return

    clearTimers()

    // If warning was active, trigger onReset to close warning UI
    if (isWarningActiveRef.current) {
      isWarningActiveRef.current = false
      onReset()
    }

    // Set the first trigger to show the warning (at timeoutMs - warningMs)
    const timeBeforeWarning = Math.max(0, timeoutMs - warningMs)
    
    timeoutTimerRef.current = setTimeout(() => {
      isWarningActiveRef.current = true
      onWarning()

      // Set the final warning timeout
      warningTimerRef.current = setTimeout(() => {
        onTimeout()
      }, warningMs)
    }, timeBeforeWarning)
  }

  useEffect(() => {
    if (!enabled) {
      clearTimers()
      return
    }

    const events = ["mousemove", "mousedown", "keypress", "touchstart", "scroll"]
    
    const handleActivity = () => {
      resetTimer()
    }

    // Register events
    events.forEach(event => {
      window.addEventListener(event, handleActivity)
    })

    // Initial timer start
    resetTimer()

    return () => {
      clearTimers()
      events.forEach(event => {
        window.removeEventListener(event, handleActivity)
      })
    }
  }, [enabled, timeoutMs, warningMs])

  return { resetTimer }
}
