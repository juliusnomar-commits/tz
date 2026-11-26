'use client'

import { useRef, useState } from 'react'
import './walkthrough-video.css'

const videoUrl = '/videos/tz-portal-walkthrough.mp4'
const posterUrl = '/videos/tz-portal-walkthrough-poster.jpg'

export function WalkthroughVideo({ label }: { label: string }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [starting, setStarting] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [failed, setFailed] = useState(false)

  async function start() {
    if (!videoRef.current) return
    setStarting(true)
    try {
      await videoRef.current.play()
    } catch {
      setStarting(false)
      setFailed(true)
    }
  }

  return <div className="walkthrough-player">
    <video ref={videoRef} controls={playing} preload="auto" playsInline poster={posterUrl} aria-label={label}
      onPlaying={() => { setPlaying(true); setStarting(false) }}
      onError={() => { setFailed(true); setStarting(false) }}>
      <source src={videoUrl} type="video/mp4" />
      Your browser does not support video playback.
    </video>
    {!playing && <div className="walkthrough-cover">
      {failed ? <a href={videoUrl} target="_blank" rel="noopener noreferrer">Open the walkthrough video</a> :
        <button type="button" onClick={() => void start()} disabled={starting} aria-label={starting ? 'Loading walkthrough video' : 'Play walkthrough video'}>
          <span aria-hidden="true">{starting ? '…' : '▶'}</span>{starting ? 'Loading video…' : 'Play walkthrough'}
        </button>}
    </div>}
  </div>
}
