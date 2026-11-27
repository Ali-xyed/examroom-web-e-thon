import { useState, useRef } from 'react'
import { Button, Panel } from './ui.jsx'

export default function ProctorConsent({ onConsented, onDenied }) {
  // onConsented: called when user has agreed and camera works
  // onDenied: called when camera is denied — allow exam to continue but record missed

  const [step, setStep] = useState('notice') // 'notice' | 'camera-check'
  const [agreed, setAgreed] = useState(false)
  const [cameraStatus, setCameraStatus] = useState('idle') // 'idle'|'checking'|'ok'|'denied'
  const videoRef = useRef(null)
  const streamRef = useRef(null)

  async function startCameraCheck() {
    setCameraStatus('checking')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240 },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
      setCameraStatus('ok')
    } catch {
      setCameraStatus('denied')
    }
  }

  function handleConfirm() {
    // Stop the preview stream (the actual capture hook will start its own)
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
    if (cameraStatus === 'ok') onConsented()
    else onDenied()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/95">
      <Panel className="max-w-lg w-full mx-4 p-8">
        {step === 'notice' ? (
          <>
            <h2 className="text-lg font-bold mb-4">Exam integrity notice</h2>
            <div className="text-sm text-muted space-y-3 mb-6">
              <p>This exam uses periodic camera snapshots to support integrity review.</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Your camera will take brief snapshots at random intervals during the exam.</li>
                <li>Images are low-resolution and stored securely. Only the exam examiner can view them.</li>
                <li>Images are deleted after the examiner reviews them.</li>
                <li>Snapshots are indicators only. They are not conclusive evidence of any misconduct.</li>
                <li>Declining camera access will be noted, but you may still continue the exam.</li>
              </ul>
            </div>
            <label className="flex items-start gap-3 mb-6 cursor-pointer">
              <input
                type="checkbox"
                checked={agreed}
                onChange={e => setAgreed(e.target.checked)}
                className="mt-0.5"
              />
              <span className="text-sm">
                I understand that camera snapshots will be taken and reviewed by the examiner.
              </span>
            </label>
            <div className="flex gap-3">
              <Button
                variant="primary"
                disabled={!agreed}
                onClick={() => {
                  setStep('camera-check')
                  startCameraCheck()
                }}
              >
                Continue to camera check
              </Button>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-lg font-bold mb-4">Camera check</h2>
            {cameraStatus === 'checking' && (
              <p className="text-muted text-sm mb-4">Checking camera access…</p>
            )}
            {cameraStatus === 'ok' && (
              <>
                <p className="text-sm text-muted mb-3">
                  Camera is working. You should see yourself below.
                </p>
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full max-w-xs rounded-lg border border-line mb-4 bg-surface"
                />
              </>
            )}
            {cameraStatus === 'denied' && (
              <p className="text-sm mb-4">
                Camera access was denied. This will be noted. You may still continue the exam.
              </p>
            )}
            {(cameraStatus === 'ok' || cameraStatus === 'denied') && (
              <div className="flex gap-3">
                <Button variant="primary" onClick={handleConfirm}>
                  {cameraStatus === 'ok' ? 'Camera works, start exam' : 'Continue without camera'}
                </Button>
              </div>
            )}
          </>
        )}
      </Panel>
    </div>
  )
}
