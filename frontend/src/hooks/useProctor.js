import { useRef, useEffect, useCallback } from 'react'

export function useProctor({ examId, attemptId, enabled, apiUrl, getToken }) {
  // enabled: boolean (proctoring_mode === 'snapshots' && !sandbox && proctorReady)
  // apiUrl: import.meta.env.VITE_API_URL
  // getToken: async function that returns JWT

  const videoRef = useRef(null) // the <video> element ref (for camera preview)
  const streamRef = useRef(null)
  const retryQueue = useRef([]) // {captureId, blob, flags, examId, attemptId}
  const nextCaptureAt = useRef(null) // Date timestamp
  const captureTimerRef = useRef(null)
  const statusRef = useRef('idle') // 'idle' | 'active' | 'denied' | 'stopped'

  // Start camera
  const startCamera = useCallback(async () => {
    if (!enabled) return false
    if (streamRef.current && statusRef.current === 'active') return true
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 480, height: 360, facingMode: 'user' },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play().catch(() => {})
      }
      statusRef.current = 'active'
      return true
    } catch {
      statusRef.current = 'denied'
      return false
    }
  }, [enabled])

  // Capture a frame: downscale to 480x360, JPEG quality 0.5
  const captureFrame = useCallback(async () => {
    if (!streamRef.current || !enabled) return null
    try {
      const video = videoRef.current
      if (!video || video.readyState < 2) return null
      const canvas = document.createElement('canvas')
      canvas.width = 480
      canvas.height = 360
      const ctx = canvas.getContext('2d')
      ctx.drawImage(video, 0, 0, 480, 360)
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.5))
      return { blob, canvas }
    } catch {
      return null
    }
  }, [enabled])

  // On-device face analysis (zero paid APIs)
  // Returns flags array: 'no_face', 'multiple_faces', 'face_off_center'
  const analyzeFrame = useCallback(async (canvas) => {
    if (!canvas) return ['no_face']
    try {
      // 1. Use browser native FaceDetector API when supported (Chrome/Edge)
      if (typeof window !== 'undefined' && 'FaceDetector' in window) {
        const detector = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 5 })
        const faces = await detector.detect(canvas)
        if (!faces || faces.length === 0) return ['no_face']
        if (faces.length > 1) return ['multiple_faces']
        const box = faces[0].boundingBox
        const cx = (box.x + box.width / 2) / canvas.width
        const cy = (box.y + box.height / 2) / canvas.height
        if (cx < 0.2 || cx > 0.8 || cy < 0.15 || cy > 0.85) return ['face_off_center']
        return []
      }

      // 2. Fallback: lightweight canvas skin-tone / presence heuristic
      const ctx = canvas.getContext('2d')
      const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height)
      let skinCount = 0
      let sumX = 0
      let sumY = 0
      const step = 4
      for (let y = 0; y < height; y += step) {
        for (let x = 0; x < width; x += step) {
          const i = (y * width + x) * 4
          const r = data[i], g = data[i + 1], b = data[i + 2]
          if (r > 95 && g > 40 && b > 20 && r > g && r > b && Math.abs(r - g) > 15) {
            skinCount++
            sumX += x
            sumY += y
          }
        }
      }
      const totalSampled = (width / step) * (height / step)
      const ratio = skinCount / totalSampled
      if (ratio < 0.015) return ['no_face']
      const cx = (sumX / skinCount) / width
      const cy = (sumY / skinCount) / height
      if (cx < 0.2 || cx > 0.8 || cy < 0.15 || cy > 0.85) return ['face_off_center']
      return []
    } catch {
      return []
    }
  }, [])

  const recordMissed = useCallback(async (flags = ['camera_unavailable']) => {
    if (!examId || !attemptId) return
    try {
      const token = await getToken()
      await fetch(`${apiUrl}/api/proctor/upload`, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ captureId: crypto.randomUUID(), attemptId, examId, flags, missed: true }),
      }).catch(() => {})
    } catch {}
  }, [examId, attemptId, apiUrl, getToken])

  // Upload frame to backend
  const uploadCapture = useCallback(async ({ captureId, blob, flags }) => {
    if (!blob || !enabled) return
    try {
      const token = await getToken()
      const form = new FormData()
      form.append('captureId', captureId)
      form.append('attemptId', attemptId)
      form.append('examId', examId)
      form.append('flags', JSON.stringify(flags))
      form.append('image', blob, `${captureId}.jpg`)
      const res = await fetch(`${apiUrl}/api/proctor/upload`, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token },
        body: form,
        signal: AbortSignal.timeout(20000),
      })
      if (!res.ok) throw new Error('Upload failed')
      // Clear from retry queue if present
      retryQueue.current = retryQueue.current.filter(r => r.captureId !== captureId)
    } catch {
      // Add to retry queue if not already there
      if (!retryQueue.current.find(r => r.captureId === captureId)) {
        retryQueue.current.push({ captureId, blob, flags })
      }
    }
  }, [enabled, examId, attemptId, apiUrl, getToken])

  // Forward-declare scheduleNext so it can reference itself in setTimeout
  const scheduleNextRef = useRef(null)
  const captureCount = useRef(0)

  // Schedule next capture:
  //   capture #0: 3s after start (immediate first snap)
  //   capture #1: 12s after start (second snap)
  //   capture #2+: random 2-6 min intervals
  const scheduleNext = useCallback((isInitial = false) => {
    if (!enabled || statusRef.current === 'stopped') return
    clearTimeout(captureTimerRef.current)

    let delay
    if (isInitial && captureCount.current === 0) {
      delay = 3000  // first capture at 3s
    } else if (captureCount.current <= 1) {
      delay = 12000 // second capture at ~15s total
    } else {
      delay = (120 + Math.random() * 240) * 1000 // 2-6 min
    }

    nextCaptureAt.current = Date.now() + delay
    captureTimerRef.current = setTimeout(async () => {
      if (statusRef.current !== 'active') return
      captureCount.current++
      const captureId = crypto.randomUUID()
      const frame = await captureFrame()
      const flags = frame?.canvas ? await analyzeFrame(frame.canvas) : ['no_face']
      if (frame?.blob) {
        await uploadCapture({ captureId, blob: frame.blob, flags })
      } else {
        await recordMissed(['no_face'])
      }
      // Schedule next via ref to avoid stale closure issues
      scheduleNextRef.current?.(false)
    }, delay)
  }, [enabled, captureFrame, analyzeFrame, uploadCapture, recordMissed])

  // Keep the ref up to date
  scheduleNextRef.current = scheduleNext

  // Retry queue processor (runs every 60s)
  useEffect(() => {
    if (!enabled) return
    const interval = setInterval(async () => {
      const item = retryQueue.current[0]
      if (item) await uploadCapture(item)
    }, 60000)
    return () => clearInterval(interval)
  }, [enabled, uploadCapture])

  // Stop camera and timers
  const stop = useCallback(() => {
    statusRef.current = 'stopped'
    clearTimeout(captureTimerRef.current)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    if (videoRef.current) videoRef.current.srcObject = null
  }, [])

  // Update nextCaptureAt from server heartbeat response (after initial 2 captures are done)
  const setNextCaptureFromServer = useCallback((serverTimestamp) => {
    if (!serverTimestamp || !enabled || captureCount.current < 2) return
    const serverTime = new Date(serverTimestamp).getTime()
    if (serverTime > Date.now()) {
      clearTimeout(captureTimerRef.current)
      const delay = serverTime - Date.now()
      nextCaptureAt.current = serverTime
      captureTimerRef.current = setTimeout(async () => {
        if (statusRef.current !== 'active') return
        const captureId = crypto.randomUUID()
        const frame = await captureFrame()
        const flags = frame?.canvas ? await analyzeFrame(frame.canvas) : ['no_face']
        if (frame?.blob) {
          await uploadCapture({ captureId, blob: frame.blob, flags })
        } else {
          await recordMissed(['no_face'])
        }
        scheduleNextRef.current?.(false)
      }, delay)
    }
  }, [enabled, captureFrame, analyzeFrame, uploadCapture, recordMissed])

  return { videoRef, startCamera, stop, scheduleNext, setNextCaptureFromServer, recordMissed, statusRef }
}
