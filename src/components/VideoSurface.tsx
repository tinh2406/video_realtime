import { useEffect, useRef } from 'react'
import { MicOff } from 'lucide-react'

export const initials = (name: string) =>
  name.trim().split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase() || 'G'

export interface VideoSurfaceProps {
  stream: MediaStream | null
  muted?: boolean
  label: string
  isSpeaking?: boolean
  isMuted?: boolean
  handRaised?: boolean
  avatarColor?: string
  className?: string
  onClick?: () => void
}

export function VideoSurface({
  stream,
  muted = false,
  label,
  isSpeaking = false,
  isMuted = false,
  handRaised = false,
  avatarColor = 'blue',
  className = '',
  onClick,
}: VideoSurfaceProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const hasVideoTrack = stream?.getVideoTracks().some((t) => t.enabled)

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream
    }
  }, [stream])

  return (
    <div
      className={`video-surface ${isSpeaking ? 'speaking-active' : ''} ${className}`}
      onClick={onClick}
    >
      {hasVideoTrack ? (
        <video ref={videoRef} autoPlay playsInline muted={muted} />
      ) : (
        <div className="video-placeholder">
          <span className={`avatar ${avatarColor ? `avatar-${avatarColor}` : 'avatar-blue'}`}>
            {initials(label)}
          </span>
        </div>
      )}

      <div className="video-overlay-tags">
        <span className="video-name">
          {label}
          {isMuted && <MicOff size={12} className="name-icon muted-icon" />}
        </span>
        {handRaised && (
          <span className="hand-raise-badge" title="Đang giơ tay">
            ✋ Giơ tay
          </span>
        )}
      </div>
      {isSpeaking && <div className="speaking-indicator-ring" />}
    </div>
  )
}
