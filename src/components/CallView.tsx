import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  AudioLines,
  Copy,
  Hand,
  LayoutGrid,
  MessageSquare,
  Mic,
  MicOff,
  MonitorUp,
  PictureInPicture,
  Send,
  Settings2,
  ShieldCheck,
  Smile,
  Users,
  Video,
  VideoOff,
  X,
} from 'lucide-react'
import type { ActiveRoomInfo, ChatMessage, FloatingReaction, PeerStatus, RoomMode, UserProfile } from '../types'
import { VideoSurface } from './VideoSurface'
import type { RoomParticipant } from '../useRoom'

const EMOJI_LIST = ['👍', '❤️', '👏', '🔥', '🎉', '😂', '🚀', '🙌']

const modeLabels: Record<RoomMode, string> = {
  call: 'Cuộc gọi 1:1',
  group: 'Gọi nhóm',
  live: 'Livestream',
}

interface CallViewProps {
  room: ActiveRoomInfo
  profile: UserProfile
  localStream: MediaStream | null
  cameraOn: boolean
  isMuted: boolean
  localIsSpeaking: boolean
  localHandRaised: boolean
  connectionState: string
  roomError: string
  participants: RoomParticipant[]
  peerStatuses: Record<string, PeerStatus>
  screenStream: MediaStream | null
  chatMessages: ChatMessage[]
  reactions: FloatingReaction[]
  devices: { audioInputs: MediaDeviceInfo[]; videoInputs: MediaDeviceInfo[] }
  selectedAudioId: string
  selectedVideoId: string
  micVolumeLevel: number
  onToggleMic: () => void
  onToggleCamera: () => void
  onShareScreen: () => Promise<MediaStream | null>
  onStopScreenShare: () => void
  onToggleHandRaise: () => void
  onSendReaction: (emoji: string) => void
  onSendChatMessage: (text: string) => void
  onLeave: () => void
  onCopyInvite: (id: string, mode: RoomMode, name: string) => void
  onSwitchAudioDevice: (id: string) => void
  onSwitchVideoDevice: (id: string) => void
}

export function CallView({
  room,
  profile,
  localStream,
  cameraOn,
  isMuted,
  localIsSpeaking,
  localHandRaised,
  connectionState,
  roomError,
  participants,
  peerStatuses,
  screenStream,
  chatMessages,
  reactions,
  devices,
  selectedAudioId,
  selectedVideoId,
  micVolumeLevel,
  onToggleMic,
  onToggleCamera,
  onShareScreen,
  onStopScreenShare,
  onToggleHandRaise,
  onSendReaction,
  onSendChatMessage,
  onLeave,
  onCopyInvite,
  onSwitchAudioDevice,
  onSwitchVideoDevice,
}: CallViewProps) {
  const [layoutMode, setLayoutMode] = useState<'pip' | 'grid'>('pip')
  const [isSwapped, setIsSwapped] = useState(false)
  const [activeTab, setActiveTab] = useState<'participants' | 'chat' | 'devices' | null>(null)
  const [chatInput, setChatInput] = useState('')
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [unreadChatCount, setUnreadChatCount] = useState(0)

  const chatBottomRef = useRef<HTMLDivElement>(null)

  const isPip = (layoutMode === 'pip' || room.mode === 'call') && participants.length > 0

  // Auto-scroll chat & count unread messages
  useEffect(() => {
    if (activeTab === 'chat') {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
      setUnreadChatCount(0)
    } else if (chatMessages.length > 0) {
      const last = chatMessages[chatMessages.length - 1]
      if (!last.isSelf) {
        setUnreadChatCount((prev) => prev + 1)
      }
    }
  }, [activeTab, chatMessages])

  return (
    <main className="live-shell">
      <header className="live-header">
        <button className="brand compact" onClick={onLeave} aria-label="Quay về trang chủ">
          <span className="brand-mark">
            <AudioLines size={18} />
          </span>
          <span>gặp nhau</span>
        </button>
        <div className="live-room-name">
          <span
            className={`live-indicator ${
              connectionState.includes('Mất') || connectionState.includes('Đã rời') ? 'is-offline' : ''
            }`}
          />
          <strong>{room.name}</strong>
          <span className="room-code">{room.id}</span>
          <button
            className="plain-icon mini-icon"
            onClick={() => onCopyInvite(room.id, room.mode, room.name)}
            title="Sao chép link mời"
          >
            <Copy size={13} />
          </button>
        </div>
        <div className="live-header-actions">
          <span className="secure-label">
            <ShieldCheck size={14} /> P2P Trực tiếp
          </span>
        </div>
      </header>

      {roomError && (
        <div className="room-alert" role="status">
          {roomError}
        </div>
      )}

      {/* Floating Reactions on Screen */}
      <div className="reaction-overlay" aria-hidden="true">
        {reactions.map((r) => (
          <div key={r.id} className="floating-reaction" style={{ left: `${r.x}%` }}>
            <span className="reaction-emoji">{r.emoji}</span>
            <span className="reaction-sender">{r.senderName}</span>
          </div>
        ))}
      </div>

      <div className="call-layout">
        <section
          className={`call-stage ${
            participants.length + (localStream && room.role === 'host' ? 1 : 0) > 1 ? 'has-guests' : ''
          } ${isPip ? 'is-pip-mode' : ''}`}
          aria-label="Phòng họp trực tiếp"
        >
          {isPip ? (
            <>
              {/* Main Full View Tile */}
              {isSwapped ? (
                localStream && room.role === 'host' && (
                  <VideoSurface
                    stream={cameraOn ? screenStream ?? localStream : null}
                    muted
                    label={`${profile.name} (Bạn)`}
                    isSpeaking={localIsSpeaking}
                    isMuted={isMuted}
                    handRaised={localHandRaised}
                    avatarColor={profile.avatarColor}
                    className="main-stage-tile"
                  />
                )
              ) : (
                participants[0] && (
                  <VideoSurface
                    stream={participants[0].stream}
                    label={participants[0].name}
                    isSpeaking={peerStatuses[participants[0].id]?.isSpeaking}
                    isMuted={peerStatuses[participants[0].id]?.isMuted}
                    handRaised={peerStatuses[participants[0].id]?.handRaised}
                    className="main-stage-tile"
                  />
                )
              )}

              {/* Floating PiP Corner Tile (Click to swap) */}
              {isSwapped ? (
                participants[0] && (
                  <div
                    className="pip-corner-wrapper"
                    onClick={() => setIsSwapped(false)}
                    title="Bấm để đổi màn hình chính"
                  >
                    <VideoSurface
                      stream={participants[0].stream}
                      label={participants[0].name}
                      isSpeaking={peerStatuses[participants[0].id]?.isSpeaking}
                      isMuted={peerStatuses[participants[0].id]?.isMuted}
                      handRaised={peerStatuses[participants[0].id]?.handRaised}
                      className="pip-corner-tile"
                    />
                    <span className="pip-hint-badge">Bấm đổi</span>
                  </div>
                )
              ) : (
                localStream && room.role === 'host' && (
                  <div
                    className="pip-corner-wrapper"
                    onClick={() => setIsSwapped(true)}
                    title="Bấm để đổi màn hình chính"
                  >
                    <VideoSurface
                      stream={cameraOn ? screenStream ?? localStream : null}
                      muted
                      label={`${profile.name} (Bạn)`}
                      isSpeaking={localIsSpeaking}
                      isMuted={isMuted}
                      handRaised={localHandRaised}
                      avatarColor={profile.avatarColor}
                      className="pip-corner-tile self-tile"
                    />
                    <span className="pip-hint-badge">Bấm đổi</span>
                  </div>
                )
              )}

              {/* Additional participants strip if more than 1 guest in PiP mode */}
              {participants.length > 1 && (
                <div className="pip-extra-strip">
                  {participants.slice(1).map((p) => {
                    const st = peerStatuses[p.id]
                    return (
                      <VideoSurface
                        key={p.id}
                        stream={p.stream}
                        label={p.name}
                        isSpeaking={st?.isSpeaking}
                        isMuted={st?.isMuted}
                        handRaised={st?.handRaised}
                        className="extra-strip-tile"
                      />
                    )
                  })}
                </div>
              )}
            </>
          ) : (
            <>
              {localStream && room.role === 'host' && (
                <VideoSurface
                  stream={cameraOn ? screenStream ?? localStream : null}
                  muted
                  label={`${profile.name} (Bạn)`}
                  isSpeaking={localIsSpeaking}
                  isMuted={isMuted}
                  handRaised={localHandRaised}
                  avatarColor={profile.avatarColor}
                  className="self-tile"
                />
              )}

              {participants.map((p) => {
                const status = peerStatuses[p.id]
                return (
                  <VideoSurface
                    key={p.id}
                    stream={p.stream}
                    label={p.name}
                    isSpeaking={status?.isSpeaking}
                    isMuted={status?.isMuted}
                    handRaised={status?.handRaised}
                  />
                )
              })}
            </>
          )}

          {!localStream && participants.length === 0 && (
            <div className="waiting-panel">
              <div className="waiting-orbit">
                <div className={`avatar avatar-${profile.avatarColor}`}>
                  {profile.name.slice(0, 2).toUpperCase()}
                </div>
                <i />
                <i />
                <i />
              </div>
              <h1>{room.role === 'viewer' ? 'Đang đợi livestream bắt đầu' : 'Phòng đã sẵn sàng'}</h1>
              <p>
                {room.role === 'viewer'
                  ? 'Người phát sẽ xuất hiện khi bắt đầu truyền video.'
                  : 'Gửi link hoặc mã phòng để mời mọi người cùng tham gia ngay.'}
              </p>
              <button
                className="button button-primary"
                onClick={() => onCopyInvite(room.id, room.mode, room.name)}
              >
                <Copy size={16} /> Sao chép liên kết mời
              </button>
            </div>
          )}

          {localStream && participants.length === 0 && (
            <div className="empty-call">
              <div className="empty-dot">
                <span />
              </div>
              <strong>Đang chờ người khác tham gia</strong>
              <span>Gửi lời mời để bắt đầu cuộc trò chuyện</span>
              <button
                className="button button-soft"
                onClick={() => onCopyInvite(room.id, room.mode, room.name)}
              >
                <Copy size={15} /> Sao chép liên kết
              </button>
            </div>
          )}

          <div className="connection-pill">
            <span className={connectionState.includes('Mất') ? 'connection-dot danger' : 'connection-dot'} />
            {connectionState}
          </div>
        </section>

        {/* In-Call Side Drawer */}
        {activeTab && (
          <aside className="call-drawer">
            <div className="drawer-header">
              <h3>
                {activeTab === 'participants' && `Thành viên (${participants.length + (localStream ? 1 : 0)})`}
                {activeTab === 'chat' && 'Trò chuyện trong phòng'}
                {activeTab === 'devices' && 'Cài đặt thiết bị'}
              </h3>
              <button className="plain-icon" onClick={() => setActiveTab(null)} aria-label="Đóng bảng">
                <X size={17} />
              </button>
            </div>

            {activeTab === 'participants' && (
              <div className="drawer-content">
                <div className="drawer-participant-list">
                  {localStream && (
                    <div className="drawer-participant-row is-self">
                      <span className={`avatar avatar-${profile.avatarColor}`}>
                        {profile.name.slice(0, 2).toUpperCase()}
                      </span>
                      <div className="participant-info">
                        <strong>{profile.name} (Bạn)</strong>
                        <small>{room.role === 'host' ? 'Chủ phòng' : 'Người xem'}</small>
                      </div>
                      <div className="participant-badges">
                        {localHandRaised && <span title="Đang giơ tay">✋</span>}
                        {isMuted ? <MicOff size={15} className="text-danger" /> : <Mic size={15} />}
                        {!cameraOn && <VideoOff size={15} className="text-danger" />}
                      </div>
                    </div>
                  )}
                  {participants.map((p) => {
                    const st = peerStatuses[p.id]
                    return (
                      <div key={p.id} className="drawer-participant-row">
                        <span className="avatar avatar-mint">{p.name.slice(0, 2).toUpperCase()}</span>
                        <div className="participant-info">
                          <strong>{p.name}</strong>
                          <small>{st?.isSpeaking ? 'Đang nói...' : 'Thành viên'}</small>
                        </div>
                        <div className="participant-badges">
                          {st?.handRaised && <span title="Đang giơ tay">✋</span>}
                          {st?.isMuted ? <MicOff size={15} className="text-danger" /> : <Mic size={15} />}
                          {st?.cameraOff && <VideoOff size={15} className="text-danger" />}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {activeTab === 'chat' && (
              <div className="drawer-content chat-drawer-content">
                <div className="chat-messages-list">
                  {chatMessages.length === 0 && (
                    <div className="chat-empty">
                      <MessageSquare size={28} />
                      <p>Chưa có tin nhắn nào. Hãy gửi lời chào đầu tiên!</p>
                    </div>
                  )}
                  {chatMessages.map((m) => (
                    <div key={m.id} className={`chat-bubble-wrap ${m.isSelf ? 'is-self' : ''}`}>
                      <div className="chat-meta">
                        <span className="chat-sender">{m.senderName}</span>
                        <span className="chat-time">
                          {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="chat-bubble">{m.text}</div>
                    </div>
                  ))}
                  <div ref={chatBottomRef} />
                </div>
                <form
                  className="chat-input-bar"
                  onSubmit={(e) => {
                    e.preventDefault()
                    if (chatInput.trim()) {
                      onSendChatMessage(chatInput)
                      setChatInput('')
                    }
                  }}
                >
                  <input
                    placeholder="Nhập tin nhắn..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                  />
                  <button type="submit" disabled={!chatInput.trim()} aria-label="Gửi">
                    <Send size={15} />
                  </button>
                </form>
              </div>
            )}

            {activeTab === 'devices' && (
              <div className="drawer-content device-drawer-content">
                <div className="device-setting-field">
                  <label>
                    <Mic size={15} /> Microphone
                  </label>
                  <select
                    value={selectedAudioId}
                    onChange={(e) => onSwitchAudioDevice(e.target.value)}
                  >
                    {devices.audioInputs.length === 0 && <option value="">Mặc định của hệ thống</option>}
                    {devices.audioInputs.map((d, idx) => (
                      <option key={d.deviceId || idx} value={d.deviceId}>
                        {d.label || `Microphone ${idx + 1}`}
                      </option>
                    ))}
                  </select>
                  <div className="mic-meter-wrap">
                    <span>Âm lượng thử:</span>
                    <div className="meter-bar">
                      <div className="meter-fill" style={{ width: `${micVolumeLevel}%` }} />
                    </div>
                  </div>
                </div>

                <div className="device-setting-field">
                  <label>
                    <Video size={15} /> Camera
                  </label>
                  <select
                    value={selectedVideoId}
                    onChange={(e) => onSwitchVideoDevice(e.target.value)}
                  >
                    {devices.videoInputs.length === 0 && <option value="">Mặc định của hệ thống</option>}
                    {devices.videoInputs.map((d, idx) => (
                      <option key={d.deviceId || idx} value={d.deviceId}>
                        {d.label || `Camera ${idx + 1}`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </aside>
        )}
      </div>

      {/* Call Footer Bar */}
      <footer className="call-footer">
        <div className="footer-room">
          <span className="room-avatar">
            <Users size={16} />
          </span>
          <span>
            <strong>{modeLabels[room.mode]}</strong>
            <small>{participants.length + (localStream ? 1 : 0)} người tham gia</small>
          </span>
        </div>

        <div className="call-controls">
          {room.role === 'host' && (
            <button
              className={`control-button ${isMuted ? 'is-off' : ''}`}
              onClick={onToggleMic}
              title={isMuted ? 'Bật micro' : 'Tắt micro'}
            >
              {isMuted ? <MicOff /> : <Mic />}
              <span>{isMuted ? 'Bật tiếng' : 'Tắt tiếng'}</span>
            </button>
          )}

          {room.role === 'host' && (
            <button
              className={`control-button ${!cameraOn ? 'is-off' : ''}`}
              onClick={onToggleCamera}
              title={cameraOn ? 'Tắt camera' : 'Bật camera'}
            >
              {cameraOn ? <Video /> : <VideoOff />}
              <span>{cameraOn ? 'Dừng video' : 'Bật video'}</span>
            </button>
          )}

          {room.role === 'host' && (
            <button
              className={`control-button ${screenStream ? 'is-off' : ''}`}
              onClick={() => (screenStream ? onStopScreenShare() : void onShareScreen())}
              title={screenStream ? 'Dừng chia sẻ màn hình' : 'Chia sẻ màn hình'}
            >
              <MonitorUp />
              <span>{screenStream ? 'Dừng chia sẻ' : 'Chia sẻ'}</span>
            </button>
          )}

          <button
            className={`control-button ${localHandRaised ? 'is-off' : ''}`}
            onClick={onToggleHandRaise}
            title={localHandRaised ? 'Hạ tay xuống' : 'Giơ tay phát biểu'}
          >
            <Hand />
            <span>{localHandRaised ? 'Hạ tay' : 'Giơ tay'}</span>
          </button>

          {/* Emoji Reactions Picker */}
          <div className="emoji-picker-container">
            <button
              className="control-button"
              onClick={() => setShowEmojiPicker((prev) => !prev)}
              title="Thả cảm xúc"
            >
              <Smile />
              <span>Thả tim</span>
            </button>
            {showEmojiPicker && (
              <div className="emoji-popup-bar">
                {EMOJI_LIST.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => {
                      onSendReaction(emoji)
                      setShowEmojiPicker(false)
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            className={`control-button ${activeTab === 'chat' ? 'is-active' : ''}`}
            onClick={() => setActiveTab((prev) => (prev === 'chat' ? null : 'chat'))}
            title="Mở trò chuyện"
          >
            <div className="badge-wrap">
              <MessageSquare />
              {unreadChatCount > 0 && <span className="pill-badge">{unreadChatCount}</span>}
            </div>
            <span>Trò chuyện</span>
          </button>

          <button
            className={`control-button ${activeTab === 'participants' ? 'is-active' : ''}`}
            onClick={() => setActiveTab((prev) => (prev === 'participants' ? null : 'participants'))}
            title="Danh sách người tham gia"
          >
            <Users />
            <span>Thành viên</span>
          </button>

          <button
            className={`control-button ${activeTab === 'devices' ? 'is-active' : ''}`}
            onClick={() => setActiveTab((prev) => (prev === 'devices' ? null : 'devices'))}
            title="Cài đặt thiết bị"
          >
            <Settings2 />
            <span>Thiết bị</span>
          </button>

          {participants.length > 0 && (
            <button
              className={`control-button ${isPip ? 'is-active' : ''}`}
              onClick={() => setLayoutMode((prev) => (prev === 'pip' ? 'grid' : 'pip'))}
              title={isPip ? 'Chuyển sang chế độ lưới (Grid)' : 'Chuyển sang chế độ góc nhỏ (PiP)'}
            >
              {isPip ? <LayoutGrid /> : <PictureInPicture />}
              <span>{isPip ? 'Lưới' : 'Góc nhỏ'}</span>
            </button>
          )}

          <button
            className="control-button"
            onClick={() => onCopyInvite(room.id, room.mode, room.name)}
            title="Mời thành viên"
          >
            <Copy />
            <span>Mời</span>
          </button>

          <button className="leave-button" onClick={onLeave} title="Rời phòng">
            <ArrowLeft size={16} />
            <span>Rời phòng</span>
          </button>
        </div>

        <div className="footer-meta">
          <span>
            <Users size={15} /> {participants.length + (localStream ? 1 : 0)}
          </span>
        </div>
      </footer>
    </main>
  )
}
