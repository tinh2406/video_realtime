import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Copy,
  Mic,
  MicOff,
  Play,
  Radio,
  Settings2,
  ShieldCheck,
  Square,
  Users,
  Video,
  VideoOff,
  Volume2,
} from 'lucide-react'
import type { ActiveRoomInfo, RoomMode, UserProfile } from '../types'
import { initials } from './VideoSurface'

interface LobbyViewProps {
  room: ActiveRoomInfo
  profile: UserProfile
  onUpdateProfileName: (name: string) => void
  onJoin: (isMuted: boolean, isCameraOff: boolean) => void
  onBackToDashboard: () => void
  devices: { audioInputs: MediaDeviceInfo[]; videoInputs: MediaDeviceInfo[] }
  selectedAudioId: string
  selectedVideoId: string
  onSelectAudio: (id: string) => void
  onSelectVideo: (id: string) => void
  onOpenDeviceModal: () => void
  onCopyInvite: (id: string, mode: RoomMode, name: string) => void
}

const modeLabels: Record<RoomMode, string> = {
  call: 'Cuộc gọi 1:1',
  group: 'Gọi nhóm',
  live: 'Livestream',
}

export function LobbyView({
  room,
  profile,
  onUpdateProfileName,
  onJoin,
  onBackToDashboard,
  devices,
  selectedAudioId,
  selectedVideoId,
  onSelectAudio,
  onSelectVideo,
  onOpenDeviceModal,
  onCopyInvite,
}: LobbyViewProps) {
  const [isMuted, setIsMuted] = useState(false)
  const [cameraOn, setCameraOn] = useState(true)
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null)
  const [micVolume, setMicVolume] = useState(0)
  const [streamError, setStreamError] = useState('')
  const [displayName, setDisplayName] = useState(profile.name)
  const [testState, setTestState] = useState<'idle' | 'recording' | 'playing'>('idle')
  const [countdown, setCountdown] = useState(3)

  const isViewer = room.mode === 'live' && room.role === 'viewer'

  const videoRef = useRef<HTMLVideoElement>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recordedChunks = useRef<Blob[]>([])
  const audioElementRef = useRef<HTMLAudioElement | null>(null)

  // Initialize camera & mic preview (skip for live viewers)
  useEffect(() => {
    if (isViewer) {
      setCameraOn(false)
      setIsMuted(true)
      return
    }

    let active = true

    navigator.mediaDevices
      .getUserMedia({
        audio: selectedAudioId ? { deviceId: { exact: selectedAudioId } } : true,
        video: selectedVideoId ? { deviceId: { exact: selectedVideoId } } : true,
      })
      .then((stream) => {
        if (!active) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        setPreviewStream(stream)
        setStreamError('')
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }

        // Setup audio volume meter
        try {
          const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
          const ctx = new AudioCtx()
          audioContextRef.current = ctx
          const source = ctx.createMediaStreamSource(stream)
          const analyser = ctx.createAnalyser()
          analyser.fftSize = 128
          source.connect(analyser)

          const buffer = new Uint8Array(analyser.frequencyBinCount)
          const interval = setInterval(() => {
            if (!active) return
            analyser.getByteFrequencyData(buffer)
            let total = 0
            for (let i = 0; i < buffer.length; i++) total += buffer[i]
            const avg = total / buffer.length
            setMicVolume(Math.min(100, Math.round(avg * 1.8)))
          }, 80)

          return () => {
            clearInterval(interval)
            void ctx.close()
          }
        } catch {
          // ignore
        }
      })
      .catch((err) => {
        if (active) {
          setStreamError(
            err.name === 'NotAllowedError'
              ? 'Chưa cấp quyền truy cập máy ảnh hoặc mic.'
              : 'Không tìm thấy máy ảnh hoặc microphone.',
          )
        }
      })

    return () => {
      active = false
      if (audioContextRef.current?.state !== 'closed') {
        void audioContextRef.current?.close()
      }
    }
  }, [isViewer, selectedAudioId, selectedVideoId])

  // Toggle mic in preview
  const togglePreviewMic = () => {
    const next = !isMuted
    previewStream?.getAudioTracks().forEach((t) => {
      t.enabled = !next
    })
    setIsMuted(next)
  }

  // Toggle camera in preview
  const togglePreviewCamera = () => {
    const next = !cameraOn
    previewStream?.getVideoTracks().forEach((t) => {
      t.enabled = next
    })
    setCameraOn(next)
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      previewStream?.getTracks().forEach((t) => t.stop())
    }
  }, [previewStream])

  // Echo test: record 3 seconds and playback
  const startEchoTest = () => {
    if (!previewStream) return
    recordedChunks.current = []
    try {
      const recorder = new MediaRecorder(previewStream)
      mediaRecorderRef.current = recorder

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunks.current.push(e.data)
      }

      recorder.onstop = () => {
        const audioBlob = new Blob(recordedChunks.current, { type: 'audio/webm' })
        const audioUrl = URL.createObjectURL(audioBlob)
        setTestState('playing')
        const audio = new Audio(audioUrl)
        audioElementRef.current = audio
        audio.onended = () => {
          setTestState('idle')
        }
        void audio.play()
      }

      recorder.start()
      setTestState('recording')
      setCountdown(3)

      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer)
            recorder.stop()
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } catch {
      setTestState('idle')
    }
  }

  const stopEchoTest = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
    if (audioElementRef.current) {
      audioElementRef.current.pause()
    }
    setTestState('idle')
  }

  const handleJoinClick = () => {
    if (displayName.trim() && displayName.trim() !== profile.name) {
      onUpdateProfileName(displayName.trim())
    }
    previewStream?.getTracks().forEach((t) => t.stop())
    onJoin(isMuted, !cameraOn)
  }

  return (
    <div className="lobby-container">
      {/* Top navigation */}
      <header className="lobby-header">
        <button className="plain-link" onClick={onBackToDashboard}>
          <ArrowLeft size={16} /> Quay về trang chủ
        </button>
        <div className="lobby-security-tag">
          <ShieldCheck size={15} /> Kết nối P2P mã hóa trực tiếp
        </div>
      </header>

      <main className="lobby-content">
        {/* Left Side: Video Preview or Viewer Card */}
        {isViewer ? (
          <div className="lobby-preview-column">
            <div className="lobby-viewer-preview-card">
              <div className="viewer-live-halo">
                <Radio size={44} className="live-halo-icon" />
              </div>
              <span className="live-pill-tag">
                <span className="live-pulse-dot" /> SẮP VÀO XEM TRỰC TIẾP
              </span>
              <h2>{room.name}</h2>
              <p className="viewer-welcome-desc">
                Bạn đang chuẩn bị tham gia theo dõi luồng phát sóng trực tiếp từ streamer.
              </p>

              <div className="viewer-features-list">
                <div className="feature-item">
                  <span className="feature-dot" />
                  <span>Hình ảnh & âm thanh độ trễ thấp qua WebRTC</span>
                </div>
                <div className="feature-item">
                  <span className="feature-dot" />
                  <span>Thả tim, gửi cảm xúc tương tác trực tiếp lên màn hình</span>
                </div>
                <div className="feature-item">
                  <span className="feature-dot" />
                  <span>Khung Live Chat thảo luận sôi nổi thời gian thực</span>
                </div>
                <div className="feature-item">
                  <span className="feature-dot" />
                  <span>Không yêu cầu quyền máy ảnh và micro</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="lobby-preview-column">
            <div className="lobby-video-surface">
              {cameraOn && !streamError ? (
                <video ref={videoRef} autoPlay playsInline muted />
              ) : (
                <div className="lobby-placeholder">
                  <span className={`avatar avatar-${profile.avatarColor}`}>
                    {initials(displayName || profile.name)}
                  </span>
                  <p>{streamError || 'Camera đang tắt'}</p>
                </div>
              )}

              {/* Quick floating controls on video */}
              <div className="lobby-video-controls">
                <button
                  className={`lobby-ctrl-btn ${isMuted ? 'is-off' : ''}`}
                  onClick={togglePreviewMic}
                  title={isMuted ? 'Bật micro' : 'Tắt micro'}
                >
                  {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
                </button>
                <button
                  className={`lobby-ctrl-btn ${!cameraOn ? 'is-off' : ''}`}
                  onClick={togglePreviewCamera}
                  title={cameraOn ? 'Tắt camera' : 'Bật camera'}
                >
                  {cameraOn ? <Video size={18} /> : <VideoOff size={18} />}
                </button>
                <button
                  className="lobby-ctrl-btn"
                  onClick={onOpenDeviceModal}
                  title="Cài đặt thiết bị"
                >
                  <Settings2 size={18} />
                </button>
              </div>
            </div>

            {/* Microphone volume status bar */}
            <div className="lobby-mic-indicator">
              <Mic size={14} className={isMuted ? 'text-danger' : 'text-success'} />
              <span>Microphone: {isMuted ? 'Đang tắt' : 'Đang hoạt động'}</span>
              {!isMuted && (
                <div className="meter-bar" style={{ maxWidth: 140 }}>
                  <div className="meter-fill" style={{ width: `${micVolume}%` }} />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Right Side: Room Info & Join Panel */}
        <div className="lobby-action-column">
          <div className="lobby-card">
            <span className="lobby-mode-badge">
              {room.mode === 'live' ? <Radio size={14} /> : <Users size={14} />} {modeLabels[room.mode]}
              {isViewer && ' • Khán giả'}
              {room.mode === 'live' && !isViewer && ' • Host (Streamer)'}
            </span>
            <h1>{room.name}</h1>
            <p className="lobby-code-row">
              Mã phòng: <code>{room.id}</code>
              <button
                className="plain-icon mini-icon"
                onClick={() => onCopyInvite(room.id, room.mode, room.name)}
                title="Sao chép link mời"
              >
                <Copy size={13} />
              </button>
            </p>

            <div className="lobby-form-group">
              <label>{isViewer ? 'Tên khán giả của bạn' : 'Tên hiển thị của bạn khi vào phòng'}</label>
              <input
                className="modal-input"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Nhập tên hiển thị..."
              />
            </div>

            {!isViewer && (
              <>
                <div className="lobby-device-selectors">
                  <div className="form-group">
                    <label>Microphone</label>
                    <select
                      className="modal-select"
                      value={selectedAudioId}
                      onChange={(e) => onSelectAudio(e.target.value)}
                    >
                      {devices.audioInputs.length === 0 && <option value="">Mặc định của hệ thống</option>}
                      {devices.audioInputs.map((d, i) => (
                        <option key={d.deviceId || i} value={d.deviceId}>
                          {d.label || `Microphone ${i + 1}`}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Camera</label>
                    <select
                      className="modal-select"
                      value={selectedVideoId}
                      onChange={(e) => onSelectVideo(e.target.value)}
                    >
                      {devices.videoInputs.length === 0 && <option value="">Mặc định của hệ thống</option>}
                      {devices.videoInputs.map((d, i) => (
                        <option key={d.deviceId || i} value={d.deviceId}>
                          {d.label || `Camera ${i + 1}`}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Quick Echo Test in Lobby */}
                <div className="lobby-echo-test">
                  {testState === 'idle' && (
                    <button className="button button-outline full-width" onClick={startEchoTest}>
                      <Play size={14} /> Nói thử 3s và nghe lại loa
                    </button>
                  )}
                  {testState === 'recording' && (
                    <button className="button button-danger full-width" onClick={stopEchoTest}>
                      <Square size={13} /> Đang ghi âm ({countdown}s)... Bấm dừng
                    </button>
                  )}
                  {testState === 'playing' && (
                    <button className="button button-primary full-width" onClick={stopEchoTest}>
                      <Volume2 size={14} /> Đang phát lại âm thanh của bạn...
                    </button>
                  )}
                </div>
              </>
            )}

            {/* Action buttons */}
            <div className="lobby-actions">
              <button
                className="button button-primary lobby-join-btn"
                onClick={handleJoinClick}
                disabled={!displayName.trim()}
              >
                {isViewer ? (
                  <>
                    <span>Vào xem livestream ngay</span>
                    <Play size={17} />
                  </>
                ) : room.mode === 'live' ? (
                  <>
                    <span>Bắt đầu phát sóng trực tiếp</span>
                    <Radio size={17} />
                  </>
                ) : (
                  <>
                    <span>Tham gia cuộc họp ngay</span>
                    <ArrowRight size={17} />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
