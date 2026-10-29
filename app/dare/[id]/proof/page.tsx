'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import AuthGuard from '@/app/components/AuthGuard'

const mono = { fontFamily: "'JetBrains Mono', monospace" }

export default function ProofPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const id = params.id
  const [phrase, setPhrase] = useState<{ codeWord: string; gesture: string } | null>(null)
  const [fixtures, setFixtures] = useState(false)
  const [fixture, setFixture] = useState('')
  const [error, setError] = useState('')
  const [recording, setRecording] = useState(false)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [startedAt, setStartedAt] = useState(0)
  const recorder = useRef<MediaRecorder | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    fetch('/api/config').then((response) => response.json()).then((body) => setFixtures(Boolean(body.aiFixtures))).catch(() => {})
  }, [])

  async function begin() {
    setError('')
    const issued = await fetch(`/api/dares/${id}/proof-challenge`, { method: 'POST' })
    const body = await issued.json()
    if (!issued.ok) {
      setError(body.error ?? 'Could not start')
      return
    }
    setPhrase(body)
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    if (videoRef.current) {
      videoRef.current.srcObject = stream
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
    rec.start()
    recorder.current = rec
    setStartedAt(Date.now())
    setRecording(true)
  }

  function stop() {
    recorder.current?.stop()
    setRecording(false)
  }

  async function upload(file: Blob) {
    if (!phrase) {
      setError('Show the code word before uploading')
      return
    }
    const form = new FormData()
    form.set('video', file, 'proof.webm')
    form.set('codeWord', phrase.codeWord)
    form.set('durationS', String(Math.max(1, Math.round((Date.now() - (startedAt || Date.now())) / 1000))))
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
      <div className="min-h-screen" style={{ backgroundColor: '#0A0A0F' }}>
        <div className="max-w-lg mx-auto px-4 py-6">
          <h1 className="text-xl font-bold mb-2" style={{ color: '#ffffff', ...mono }}>Proof</h1>
          <p className="text-sm mb-4" style={{ color: '#8888AA' }}>The code word and gesture appear when recording starts, so the clip cannot be filmed in advance.</p>
          {phrase && (
            <div className="rounded-xl border p-4 mb-4" style={{ borderColor: '#6C63FF', backgroundColor: '#0D0D1A' }}>
              <p className="text-xs" style={{ color: '#8888AA', ...mono }}>SAY THIS IN THE FIRST 10 SECONDS</p>
              <p className="text-2xl font-bold" style={{ color: '#ffffff', ...mono }}>{phrase.codeWord}</p>
              <p className="text-sm mt-2" style={{ color: '#00FF87' }}>{phrase.gesture}</p>
            </div>
          )}
          <video ref={videoRef} muted playsInline className="w-full rounded-xl mb-4 bg-black" />
          {error && <p className="text-sm mb-3" style={{ color: '#FF4757' }}>{error}</p>}
          {!recording && !blob && <button onClick={begin} className="w-full py-3 rounded-xl font-semibold mb-3" style={{ backgroundColor: '#6C63FF', color: '#ffffff', ...mono }}>Start recording</button>}
          {recording && <button onClick={stop} className="w-full py-3 rounded-xl font-semibold mb-3" style={{ backgroundColor: '#FF4757', color: '#ffffff', ...mono }}>Stop</button>}
          {blob && <button onClick={() => upload(blob)} className="w-full py-3 rounded-xl font-semibold mb-3" style={{ backgroundColor: '#00FF87', color: '#0A0A0F', ...mono }}>Upload clip</button>}
          <label className="block text-xs mb-2" style={{ color: '#8888AA', ...mono }}>OR UPLOAD A FILE AFTER THE CODE WORD IS SHOWN</label>
          <input type="file" accept="video/*" onChange={(event) => {
            const file = event.target.files?.[0]
            if (!phrase) {
              setError('Start once so the code word is issued, then upload')
              return
            }
            if (file) upload(file)
          }} className="text-sm" style={{ color: '#8888AA' }} />
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
