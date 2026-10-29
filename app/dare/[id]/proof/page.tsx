'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import AuthGuard from '@/app/components/AuthGuard'

const mono = { fontFamily: "'JetBrains Mono', monospace" }
const MAX_SECONDS = 90

export default function ProofPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const id = params.id
  const [phrase, setPhrase] = useState<{ codeWord: string; gesture: string; issuedAt?: string | null } | null>(null)
  const [geo, setGeo] = useState<{ latitude: number; longitude: number } | null>(null)
  const [fixtures, setFixtures] = useState(false)
  const [fixture, setFixture] = useState('')
  const [error, setError] = useState('')
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [facing, setFacing] = useState<'environment' | 'user'>('environment')
  const [startedAt, setStartedAt] = useState(0)
  const recorder = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const timer = useRef<number | null>(null)

  useEffect(() => {
    fetch('/api/config').then((response) => response.json()).then((body) => setFixtures(Boolean(body.aiFixtures))).catch(() => {})
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop())
      if (timer.current) window.clearInterval(timer.current)
    }
  }, [])

  function stop() {
    if (timer.current) window.clearInterval(timer.current)
    recorder.current?.stop()
    setRecording(false)
  }

  async function begin(nextFacing = facing) {
    setError('')
    setBlob(null)
    const issued = await fetch(`/api/dares/${id}/proof-challenge`, { method: 'POST' })
    const body = await issued.json()
    if (!issued.ok) {
      setError(body.error ?? 'Could not start')
      return
    }
    setPhrase(body)
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => setGeo({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
        () => setGeo(null),
        { enableHighAccuracy: false, timeout: 4000, maximumAge: 60_000 },
      )
    }
    streamRef.current?.getTracks().forEach((track) => track.stop())
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: { facingMode: nextFacing, width: { ideal: 720 }, height: { ideal: 1280 } },
      })
    } catch {
      setError('The camera is unavailable. Upload a file instead. On a phone, allow camera access and use Safari or Chrome.')
      return
    }
    streamRef.current = stream
    if (videoRef.current) {
      videoRef.current.srcObject = stream
      videoRef.current.muted = true
      await videoRef.current.play()
    }
    const rec = new MediaRecorder(stream)
    const chunks: Blob[] = []
    rec.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data) }
    rec.onstop = () => {
      setBlob(new Blob(chunks, { type: rec.mimeType || 'video/webm' }))
      stream.getTracks().forEach((track) => track.stop())
      if (videoRef.current) videoRef.current.srcObject = null
    }
    rec.start(1000)
    recorder.current = rec
    const started = Date.now()
    setStartedAt(started)
    setElapsed(0)
    setRecording(true)
    timer.current = window.setInterval(() => {
      const seconds = Math.round((Date.now() - started) / 1000)
      setElapsed(seconds)
      if (seconds >= MAX_SECONDS) stop()
    }, 500)
  }

  async function upload(file: Blob) {
    if (!phrase) {
      setError('Show the code word before uploading')
      return
    }
    if (file.size > 80 * 1024 * 1024) {
      setError('That file is over 80 MB.')
      return
    }
    const form = new FormData()
    form.set('video', file, 'proof.webm')
    form.set('codeWord', phrase.codeWord)
    form.set('capture', 'camera')
    form.set('startedAt', new Date(startedAt || Date.now()).toISOString())
    if (geo) {
      form.set('latitude', String(geo.latitude))
      form.set('longitude', String(geo.longitude))
    }
    form.set('durationS', String(Math.max(1, Math.min(MAX_SECONDS, Math.round((Date.now() - (startedAt || Date.now())) / 1000)))))
    if (fixture) form.set('fixture', fixture)
    const response = await fetch(`/api/dares/${id}/proof`, { method: 'POST', body: form })
    const body = await response.json()
    if (!response.ok) {
      setError(body.error ?? 'Upload failed')
      return
    }
    router.push(`/dare/${id}`)
  }

  return (
    <AuthGuard>
      <div className="min-h-screen" style={{ backgroundColor: 'transparent' }}>
        <div className="max-w-lg mx-auto px-4 py-6">
          <h1 className="text-xl font-bold mb-2" style={{ color: '#ffffff', ...mono }}>Proof</h1>
          <p className="text-sm mb-4" style={{ color: '#c4bdd6' }}>
            Live camera only. The code word is issued by the server when recording starts and must be spoken or shown. File and gallery uploads are not accepted. Location is optional.
          </p>
          {phrase && (
            <div className="dare-card p-4 mb-4">
              <p className="dare-kicker">Say this in the first 10 seconds</p>
              <p className="text-2xl font-bold mt-1" style={{ color: '#ffffff', ...mono }}>{phrase.codeWord}</p>
              <p className="text-sm mt-2" style={{ color: '#7dffe0' }}>{phrase.gesture}</p>
              {phrase.issuedAt && <p className="text-xs mt-2" style={{ color: '#c4bdd6' }}>Server time {new Date(phrase.issuedAt).toLocaleString()}</p>}
            </div>
          )}
          <video ref={videoRef} muted playsInline autoPlay className="w-full rounded-xl mb-4 bg-black aspect-[3/4] object-cover" />
          {recording && <p className="text-sm mb-2" style={{ color: '#ffffff', ...mono }}>{elapsed}s / {MAX_SECONDS}s</p>}
          {error && <p className="text-sm mb-3" style={{ color: '#FF4757' }}>{error}</p>}
          <div className="flex flex-col gap-3">
            {!recording && (
              <button onClick={() => begin(facing)} className="w-full py-4 rounded-xl font-semibold text-base" style={{ backgroundColor: '#6C63FF', color: '#ffffff', ...mono }}>
                Start camera
              </button>
            )}
            {!recording && (
              <button onClick={() => { const next = facing === 'environment' ? 'user' : 'environment'; setFacing(next) }} className="w-full py-3 rounded-xl text-sm" style={{ backgroundColor: '#1A1A2E', color: '#ffffff', ...mono }}>
                Camera: {facing === 'environment' ? 'back' : 'front'}
              </button>
            )}
            {recording && (
              <button onClick={stop} className="w-full py-4 rounded-xl font-semibold" style={{ backgroundColor: '#FF4757', color: '#ffffff', ...mono }}>Stop</button>
            )}
            {blob && (
              <button onClick={() => upload(blob)} className="w-full py-4 rounded-xl font-semibold" style={{ backgroundColor: '#00FF87', color: '#0A0A0F', ...mono }}>Upload this clip</button>
            )}
          </div>
          {fixtures && (
            <label className="block mt-4 text-xs" style={{ color: '#8888AA' }}>
              Dev fixture
              <select value={fixture} onChange={(event) => setFixture(event.target.value)} className="ml-2 bg-transparent">
                <option value="">queue (default)</option>
                <option value="pass">pass</option>
                <option value="fail">fail</option>
                <option value="unsure">unsure</option>
                <option value="injection">injection</option>
              </select>
            </label>
          )}
        </div>
      </div>
    </AuthGuard>
  )
}
