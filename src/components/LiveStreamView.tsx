import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  AudioLines,
  Copy,
  Heart,
  Maximize2,
  MessageSquare,
  Mic,
  MicOff,
  Minimize2,
  MonitorUp,
  Radio,
  Send,
  Users,
  Video,
  VideoOff,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'
import type { ActiveRoomInfo, ChatMessage, FloatingReaction, PeerStatus, RoomMode, UserProfile } from '../types'
import type { RoomParticipant } from '../useRoom'
import { initials, VideoSurface } from './VideoSurface'

const STREAM_EMOJIS = ['❤️', '🔥', '👏', '🎉', '🌟', '🙌', '💯', '😂']

interface LiveStreamViewProps {
  room: ActiveRoomInfo
  profile: UserProfile
  localStream: MediaStream | null
  cameraOn: boolean
  isMuted: boolean
  connectionState: string
  roomError: string
  participants: RoomParticipant[]
  peerStatuses: Record<string, PeerStatus>
  screenStream: MediaStream | null
  chatMessages: ChatMessage[]
  reactions: FloatingReaction[]
  onToggleMic: () => void
  onToggleCamera: () => void
  onShareScreen: () => Promise<MediaStream | null>
  onStopScreenShare: () => void
  onSendReaction: (emoji: string) => void
  onSendChatMessage: (text: string) => void
  onLeave: () => void
  onCopyInvite: (id: string, mode: RoomMode, name: string) => void
}

export function LiveStreamView({
  room,
  profile,
  localStream,
  cameraOn,
  isMuted,
  connectionState,
  roomError,
  participants,
  peerStatuses,
  screenStream,
  chatMessages,
  reactions,
  onToggleMic,
  onToggleCamera,
  onShareScreen,
  onStopScreenShare,
  onSendReaction,
  onSendChatMessage,
  onLeave,
  onCopyInvite,
}: LiveStreamViewProps) {
  const isHost = room.role === 'host'
  const [streamUptime, setStreamUptime] = useState(0)
  const [chatInput, setChatInput] = useState('')
  const [chatOpen, setChatOpen] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [viewerVolume, setViewerVolume] = useState(1)
  const [viewerMuted, setViewerMuted] = useState(false)
  const [likesCount, setLikesCount] = useState(0)

  const streamContainerRef = useRef<HTMLDivElement>(null)
  const hostVideoRef = useRef<HTMLVideoElement>(null)
  const viewerVideoRef = useRef<HTMLVideoElement>(null)
  const chatBottomRef = useRef<HTMLDivElement>(null)

  // Stream uptime ticker
  useEffect(() => {
    const timer = setInterval(() => {
      setStreamUptime((prev) => prev + 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const formatUptime = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    if (h > 0) {
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  // Bind local stream for host
  useEffect(() => {
    if (isHost && hostVideoRef.current) {
      hostVideoRef.current.srcObject = screenStream ?? localStream
    }
  }, [isHost, localStream, screenStream])

  // Bind remote stream for viewer
  // In livestream, the remote participant with host stream is participants[0]
  const streamerParticipant = participants[0]
  useEffect(() => {
    if (!isHost && viewerVideoRef.current) {
      if (streamerParticipant?.stream) {
        const presentationStream = streamerParticipant.screenStream
          ? new MediaStream([
              ...streamerParticipant.screenStream.getVideoTracks(),
              ...streamerParticipant.stream.getAudioTracks(),
            ])
          : streamerParticipant.stream
        viewerVideoRef.current.srcObject = presentationStream
        viewerVideoRef.current.volume = viewerMuted ? 0 : viewerVolume
      } else {
        viewerVideoRef.current.srcObject = null
      }
    }
  }, [isHost, streamerParticipant, viewerMuted, viewerVolume])

  // Auto-scroll chat
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  // Fullscreen toggle
  const toggleFullscreen = async () => {
    if (!streamContainerRef.current) return
    try {
      if (!document.fullscreenElement) {
        await streamContainerRef.current.requestFullscreen()
        setIsFullscreen(true)
      } else {
        await document.exitFullscreen()
        setIsFullscreen(false)
      }
    } catch {
      // ignore
    }
  }

  // Handle reaction burst
  const handleLikeBurst = () => {
    setLikesCount((prev) => prev + 1)
    onSendReaction('❤️')
  }

  const viewersCount = Math.max(1, participants.length + (isHost ? 0 : 1))

  return (
    <div className="stream-layout-shell" ref={streamContainerRef}>
      {/* Top Stream Header */}
      <header className="stream-topbar">
        <div className="stream-header-left">
          <button className="plain-link stream-back-btn" onClick={onLeave}>
            <ArrowLeft size={16} /> {isHost ? 'Kết thúc stream' : 'Rời luồng'}
          </button>
          <div className="stream-brand-badge">
            <span className="live-pulse-dot" />
            <strong>TRỰC TIẾP</strong>
          </div>
          <span className="stream-uptime-badge">{formatUptime(streamUptime)}</span>
          {connectionState !== 'connected' && (
            <span className="stream-uptime-badge" style={{ color: '#f59e0b' }}>
              {connectionState === 'connecting' ? 'Đang kết nối...' : connectionState}
            </span>
          )}
        </div>

        <div className="stream-header-center">
          <h1 className="stream-title">{room.name}</h1>
          <span className="stream-room-code">
            Mã: <code>{room.id}</code>
            <button
              className="plain-icon mini-icon"
              onClick={() => onCopyInvite(room.id, 'live', room.name)}
              title="Sao chép link mời khán giả"
            >
              <Copy size={13} />
            </button>
          </span>
        </div>

        <div className="stream-header-right">
          <div className="stream-viewer-count" title="Số khán giả đang theo dõi">
            <Users size={15} />
            <span>{viewersCount} đang xem</span>
          </div>
          <button
            className={`stream-chat-toggle-btn ${chatOpen ? 'active' : ''}`}
            onClick={() => setChatOpen((prev) => !prev)}
            title="Đóng / mở khung trò chuyện"
          >
            <MessageSquare size={16} />
            <span>Live Chat</span>
          </button>
        </div>
      </header>

      {roomError && <div className="room-alert">{roomError}</div>}

      {/* Floating Reaction Hearts on Screen */}
      <div className="reaction-overlay" aria-hidden="true">
        {reactions.map((r) => (
          <div key={r.id} className="floating-reaction" style={{ left: `${r.x}%` }}>
            <span className="reaction-emoji">{r.emoji}</span>
            <span className="reaction-sender">{r.senderName}</span>
          </div>
        ))}
      </div>

      <div className="stream-body">
        {/* Main Cinema Screen */}
        <section className="stream-stage-column">
          <div className="stream-canvas-wrapper">
            {isHost ? (
              /* HOST / STREAMER STUDIO VIEW */
              <div className="stream-canvas">
                {(screenStream || (cameraOn && localStream)) ? (
                  <video ref={hostVideoRef} autoPlay playsInline muted />
                ) : (
                  <div className="stream-placeholder">
                    <span className={`avatar avatar-${profile.avatarColor}`}>
                      {initials(profile.name)}
                    </span>
                    <strong>Camera của bạn đang tắt</strong>
                    <p>Bật camera hoặc chia sẻ màn hình để phát sóng cho khán giả.</p>
                  </div>
                )}

                {/* Studio Overlay Status */}
                <div className="studio-watermark">
                  <span className="live-pill">
                    <Radio size={13} /> ĐANG LIVE TỚI KHÁN GIẢ
                  </span>
                  {screenStream && <span className="screen-pill">Đang chia sẻ màn hình</span>}
                  {screenStream && cameraOn && localStream && (
                    <VideoSurface stream={localStream} muted label={`${profile.name} · Camera`} className="screen-camera-pip" />
                  )}
                </div>

                {/* Streamer Studio Toolbar */}
                <div className="studio-bottom-controls">
                  <button
                    className={`studio-btn ${isMuted ? 'is-off' : ''}`}
                    onClick={onToggleMic}
                    title={isMuted ? 'Bật mic' : 'Tắt mic'}
                  >
                    {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
                    <span>{isMuted ? 'Mic tắt' : 'Mic bật'}</span>
                  </button>

                  <button
                    className={`studio-btn ${!cameraOn ? 'is-off' : ''}`}
                    onClick={onToggleCamera}
                    title={cameraOn ? 'Tắt camera' : 'Bật camera'}
                  >
                    {cameraOn ? <Video size={18} /> : <VideoOff size={18} />}
                    <span>{cameraOn ? 'Cam bật' : 'Cam tắt'}</span>
                  </button>

                  <button
                    className={`studio-btn ${screenStream ? 'is-active' : ''}`}
                    onClick={() => (screenStream ? onStopScreenShare() : void onShareScreen())}
                    title={screenStream ? 'Dừng chia sẻ màn hình' : 'Chia sẻ màn hình'}
                  >
                    <MonitorUp size={18} />
                    <span>{screenStream ? 'Dừng chia sẻ' : 'Chia sẻ màn hình'}</span>
                  </button>

                  <div className="studio-divider" />

                  <button
                    className="studio-btn studio-invite-btn"
                    onClick={() => onCopyInvite(room.id, 'live', room.name)}
                    title="Sao chép link mời người xem"
                  >
                    <Copy size={16} />
                    <span>Mời người xem</span>
                  </button>

                  <button
                    className="studio-btn studio-end-btn"
                    onClick={onLeave}
                    title="Dừng phát sóng trực tiếp"
                  >
                    <Radio size={16} />
                    <span>Kết thúc live</span>
                  </button>
                </div>
              </div>
            ) : (
              /* VIEWER / AUDIENCE THEATER PLAYER */
              <div className="stream-canvas viewer-cinema-canvas">
                {streamerParticipant ? (
                  <>
                    <video ref={viewerVideoRef} autoPlay playsInline muted={viewerMuted} />
                    {streamerParticipant.screenStream && (
                      <VideoSurface stream={streamerParticipant.stream} label={`${streamerParticipant.name} · Camera`} className="screen-camera-pip" />
                    )}
                  </>
                ) : (
                  <div className="stream-placeholder">
                    <div className="live-waiting-orbit">
                      <Radio size={36} className="orbit-icon" />
                    </div>
                    <strong>Streamer đang chuẩn bị phát sóng...</strong>
                    <p>Hãy ngồi thư giãn và trò chuyện cùng mọi người trong khung Live Chat!</p>
                  </div>
                )}

                {/* Theater Player Controls Bar (appears on hover) */}
                <div className="viewer-player-bar">
                  <div className="player-left">
                    <button
                      className="player-icon-btn"
                      onClick={() => setViewerMuted((prev) => !prev)}
                      title={viewerMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
                    >
                      {viewerMuted || viewerVolume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
                    </button>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={viewerMuted ? 0 : viewerVolume}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value)
                        setViewerVolume(val)
                        if (val > 0) setViewerMuted(false)
                      }}
                      className="player-volume-slider"
                      title="Âm lượng"
                    />
                    <span className="player-tag">WebRTC HD</span>
                  </div>

                  <div className="player-right">
                    <button
                      className="player-icon-btn"
                      onClick={toggleFullscreen}
                      title={isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}
                    >
                      {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Under-stream Info Bar */}
          <div className="stream-meta-row">
            <div className="streamer-profile">
              <span className={`avatar avatar-${isHost ? profile.avatarColor : 'violet'}`}>
                {initials(isHost ? profile.name : streamerParticipant?.name || 'Host')}
              </span>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <strong>{isHost ? profile.name : streamerParticipant?.name || 'Người phát sóng'}</strong>
                  {!isHost && streamerParticipant && peerStatuses[streamerParticipant.id]?.isSpeaking && (
                    <span className="live-pill" style={{ background: '#10b981', padding: '2px 6px', fontSize: 10 }}>
                      Đang nói
                    </span>
                  )}
                </div>
                <small>{isHost ? 'Chủ phòng (Streamer)' : 'Đang phát sóng trực tiếp'}</small>
              </div>
            </div>

            <div className="stream-interactive-bar">
              <button className="like-burst-btn" onClick={handleLikeBurst} title="Thả tim cho streamer">
                <Heart size={18} fill="#ef4444" color="#ef4444" />
                <span>{likesCount}</span>
              </button>
              <div className="emoji-bar-shortcuts">
                {STREAM_EMOJIS.map((emoji) => (
                  <button key={emoji} onClick={() => onSendReaction(emoji)} className="quick-emoji-btn">
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Live Chat Sidebar (Twitch / YouTube style) */}
        {chatOpen && (
          <aside className="stream-chat-column">
            <div className="stream-chat-header">
              <h3>
                <MessageSquare size={15} /> Trò chuyện trực tiếp
              </h3>
              <button className="plain-icon mini-icon" onClick={() => setChatOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <div className="stream-chat-feed">
              <div className="stream-chat-welcome">
                <AudioLines size={24} />
                <p>Chào mừng bạn đến với kênh phát sóng trực tiếp! Hãy giữ bình luận lịch sự và văn minh.</p>
              </div>

              {chatMessages.map((m) => (
                <div key={m.id} className={`stream-chat-message ${m.isSelf ? 'is-self' : ''}`}>
                  <span className="chat-user-badge">{m.senderName}:</span>
                  <span className="chat-user-text">{m.text}</span>
                  <span className="chat-user-time">
                    {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
              <div ref={chatBottomRef} />
            </div>

            <form
              className="stream-chat-input-form"
              onSubmit={(e) => {
                e.preventDefault()
                if (chatInput.trim()) {
                  onSendChatMessage(chatInput)
                  setChatInput('')
                }
              }}
            >
              <input
                placeholder="Gửi tin nhắn trong luồng trực tiếp..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
              />
              <button type="submit" disabled={!chatInput.trim()} aria-label="Gửi bình luận">
                <Send size={15} />
              </button>
            </form>
          </aside>
        )}
      </div>
    </div>
  )
}
