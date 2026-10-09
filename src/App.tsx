import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  AudioLines,
  Bell,
  Check,
  CircleHelp,
  Copy,
  Hand,
  Link2,
  MessageSquare,
  Mic,
  MicOff,
  MonitorUp,
  Plus,
  Radio,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Smile,
  Sparkles,
  Star,
  Trash2,
  Users,
  Video,
  VideoOff,
  Volume2,
  X,
} from 'lucide-react'
import {
  deleteRoomHistory,
  formatTimeAgo,
  loadRoomHistory,
  loadUserProfile,
  recordRoomVisit,
  saveUserProfile,
  toggleFavoriteRoom,
} from './storage'
import type { RoomHistoryItem, RoomMode, RoomRole, UserProfile } from './types'
import { useRoom } from './useRoom'

const EMOJI_LIST = ['👍', '❤️', '👏', '🔥', '🎉', '😂', '🚀', '🙌']
const AVATAR_COLORS = [
  { id: 'blue', label: 'Xanh dương', class: 'avatar-blue' },
  { id: 'mint', label: 'Xanh bạc hà', class: 'avatar-mint' },
  { id: 'lilac', label: 'Tím nhạt', class: 'avatar-lilac' },
  { id: 'peach', label: 'Cam đào', class: 'avatar-peach' },
  { id: 'sky', label: 'Xanh da trời', class: 'avatar-sky' },
  { id: 'photo', label: 'Nâu đất', class: 'avatar-photo' },
]

const modeLabels: Record<RoomMode, string> = {
  call: 'Cuộc gọi 1:1',
  group: 'Gọi nhóm',
  live: 'Livestream',
}

const initials = (name: string) =>
  name.trim().split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase() || 'G'

function VideoSurface({
  stream,
  muted = false,
  label,
  isSpeaking = false,
  isMuted = false,
  handRaised = false,
  avatarColor = 'blue',
  className = '',
}: {
  stream: MediaStream | null
  muted?: boolean
  label: string
  isSpeaking?: boolean
  isMuted?: boolean
  handRaised?: boolean
  avatarColor?: string
  className?: string
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const hasVideoTrack = stream?.getVideoTracks().some((t) => t.enabled)

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream
    }
  }, [stream])

  return (
    <div className={`video-surface ${isSpeaking ? 'speaking-active' : ''} ${className}`}>
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

function App() {
  const [profile, setProfile] = useState<UserProfile>(loadUserProfile)
  const [roomHistory, setRoomHistory] = useState<RoomHistoryItem[]>(loadRoomHistory)
  const [activeFilter, setActiveFilter] = useState<'all' | 'favorites' | RoomMode>('all')

  const [room, setRoom] = useState<{ id: string; name: string; mode: RoomMode; role: RoomRole } | null>(null)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [isMuted, setIsMuted] = useState(false)
  const [cameraOn, setCameraOn] = useState(true)

  // Dialog states
  const [createDialog, setCreateDialog] = useState(false)
  const [profileDialog, setProfileDialog] = useState(false)
  const [settingsDialog, setSettingsDialog] = useState(false)

  // Form states for creating room
  const [newRoomName, setNewRoomName] = useState('')
  const [newRoomCode, setNewRoomCode] = useState('')
  const [selectedMode, setSelectedMode] = useState<RoomMode>('group')
  const [joinCode, setJoinCode] = useState('')

  // In-call UI states
  const [activeTab, setActiveTab] = useState<'participants' | 'chat' | 'devices' | null>(null)
  const [chatInput, setChatInput] = useState('')
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [unreadChatCount, setUnreadChatCount] = useState(0)

  // Device management
  const [devices, setDevices] = useState<{ audioInputs: MediaDeviceInfo[]; videoInputs: MediaDeviceInfo[] }>({
    audioInputs: [],
    videoInputs: [],
  })
  const [selectedAudioId, setSelectedAudioId] = useState<string>('')
  const [selectedVideoId, setSelectedVideoId] = useState<string>('')
  const [micVolumeLevel, setMicVolumeLevel] = useState<number>(0)

  // Alerts & UX
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  const autoJoined = useRef(false)
  const chatBottomRef = useRef<HTMLDivElement>(null)

  const parsedRoom = new URLSearchParams(window.location.search).get('room')
  const queryMode = new URLSearchParams(window.location.search).get('mode')
  const queryRole = new URLSearchParams(window.location.search).get('role')
  const queryName = new URLSearchParams(window.location.search).get('name')

  // Save profile updates
  const handleUpdateProfile = (updated: Partial<UserProfile>) => {
    const next = { ...profile, ...updated }
    setProfile(next)
    saveUserProfile(next)
  }

  // Hook into room realtime connection
  const {
    participants,
    connectionState,
    roomError,
    leaveRoom,
    screenStream,
    shareScreen,
    stopScreenShare,
    chatMessages,
    sendChatMessage,
    reactions,
    sendReaction,
    peerStatuses,
    localHandRaised,
    localIsSpeaking,
    toggleHandRaise,
    broadcastLocalStatus,
    replaceTrack,
  } = useRoom(room?.id ?? null, room?.mode ?? 'group', profile.name, localStream)

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

  // Enumerate user devices
  const refreshDevices = useCallback(async () => {
    try {
      const all = await navigator.mediaDevices.enumerateDevices()
      setDevices({
        audioInputs: all.filter((d) => d.kind === 'audioinput'),
        videoInputs: all.filter((d) => d.kind === 'videoinput'),
      })
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    void refreshDevices()
  }, [refreshDevices])

  // Mic test volume meter for dashboard & settings
  useEffect(() => {
    if (!localStream) {
      setMicVolumeLevel(0)
      return
    }
    const audioTrack = localStream.getAudioTracks()[0]
    if (!audioTrack || !audioTrack.enabled) {
      setMicVolumeLevel(0)
      return
    }

    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const ctx = new AudioCtx()
      const source = ctx.createMediaStreamSource(localStream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 128
      source.connect(analyser)

      const buffer = new Uint8Array(analyser.frequencyBinCount)
      const timer = setInterval(() => {
        analyser.getByteFrequencyData(buffer)
        let total = 0
        for (let i = 0; i < buffer.length; i++) total += buffer[i]
        const val = Math.min(100, Math.round((total / buffer.length) * 1.8))
        setMicVolumeLevel(val)
      }, 100)

      return () => {
        clearInterval(timer)
        void ctx.close()
      }
    } catch {
      // ignore
    }
  }, [localStream])

  // Join or Create Room
  const openRoom = useCallback(
    async (
      mode: RoomMode,
      id?: string,
      role: RoomRole = 'host',
      customName?: string,
    ) => {
      if (busy) return
      setBusy(true)
      setError('')
      setNotice('')

      const roomId = id?.trim().toUpperCase() || crypto.randomUUID().slice(0, 8).toUpperCase()
      if (!/^[A-Za-z0-9_-]{1,64}$/.test(roomId)) {
        setError('Mã phòng chỉ được có chữ cái, số, dấu gạch ngang hoặc gạch dưới.')
        setBusy(false)
        return
      }

      const roomTitle =
        customName?.trim() ||
        (mode === 'live'
          ? `Livestream của ${profile.name}`
          : mode === 'call'
          ? `Cuộc gọi 1:1 (${roomId})`
          : `Họp nhóm ${roomId}`)

      let stream: MediaStream | null = null
      if (role === 'host') {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: selectedAudioId ? { deviceId: { exact: selectedAudioId } } : true,
            video:
              mode !== 'live' || role === 'host'
                ? selectedVideoId
                  ? { deviceId: { exact: selectedVideoId } }
                  : true
                : false,
          })
          setIsMuted(false)
          setCameraOn(true)
        } catch (cause) {
          const message =
            cause instanceof Error && cause.name === 'NotAllowedError'
              ? 'Bạn chưa cấp quyền camera hoặc micro. Vẫn có thể tiếp tục vào phòng và bật lại sau.'
              : 'Không truy cập được camera hoặc micro. Bạn vẫn có thể vào phòng để nghe và xem người khác.'
          setNotice(message)
        }
      }

      setLocalStream(stream)
      setRoom({ id: roomId, name: roomTitle, mode, role })
      setCreateDialog(false)

      // Save to real room history
      const updatedHistory = recordRoomVisit({
        id: roomId,
        name: roomTitle,
        mode,
        role,
      })
      setRoomHistory(updatedHistory)

      // Update URL
      const params = new URLSearchParams()
      params.set('room', roomId)
      params.set('mode', mode)
      params.set('name', roomTitle)
      if (role === 'viewer') params.set('role', 'viewer')
      window.history.replaceState({}, '', `?${params.toString()}`)

      setBusy(false)
    },
    [busy, profile.name, selectedAudioId, selectedVideoId],
  )

  // Handle URL auto-join
  useEffect(() => {
    if (parsedRoom && !autoJoined.current) {
      autoJoined.current = true
      const mode: RoomMode = queryMode === 'live' ? 'live' : queryMode === 'call' ? 'call' : 'group'
      const role: RoomRole = queryRole === 'viewer' ? 'viewer' : 'host'
      void openRoom(mode, parsedRoom, role, queryName ?? undefined)
    }
  }, [openRoom, parsedRoom, queryMode, queryName, queryRole])

  // Leave room
  const leave = () => {
    leaveRoom()
    localStream?.getTracks().forEach((track) => track.stop())
    screenStream?.getTracks().forEach((track) => track.stop())
    setLocalStream(null)
    setRoom(null)
    setActiveTab(null)
    window.history.replaceState({}, '', window.location.pathname)
  }

  // Toggle Microphone
  const toggleMic = async () => {
    const next = !isMuted
    let stream = localStream
    if (!stream) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: cameraOn })
        setLocalStream(stream)
      } catch {
        setNotice('Không thể bật micro do thiếu quyền truy cập.')
        return
      }
    }
    stream?.getAudioTracks().forEach((t) => {
      t.enabled = !next
    })
    setIsMuted(next)
    broadcastLocalStatus({ isMuted: next })
  }

  // Toggle Camera
  const toggleCamera = async () => {
    const next = !cameraOn
    let stream = localStream
    if (!stream) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: !isMuted, video: true })
        setLocalStream(stream)
      } catch {
        setNotice('Không thể bật camera do thiếu quyền truy cập.')
        return
      }
    }
    stream?.getVideoTracks().forEach((t) => {
      t.enabled = next
    })
    setCameraOn(next)
    broadcastLocalStatus({ cameraOff: !next })
  }

  // Switch camera device
  const handleSwitchVideoDevice = async (deviceId: string) => {
    setSelectedVideoId(deviceId)
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId } },
      })
      const newTrack = newStream.getVideoTracks()[0]
      if (newTrack && localStream) {
        const oldTrack = localStream.getVideoTracks()[0]
        if (oldTrack) {
          localStream.removeTrack(oldTrack)
          oldTrack.stop()
        }
        localStream.addTrack(newTrack)
        await replaceTrack('video', newTrack)
      }
    } catch {
      setError('Không thể chuyển đổi camera.')
    }
  }

  // Switch audio input device
  const handleSwitchAudioDevice = async (deviceId: string) => {
    setSelectedAudioId(deviceId)
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: deviceId } },
      })
      const newTrack = newStream.getAudioTracks()[0]
      if (newTrack && localStream) {
        const oldTrack = localStream.getAudioTracks()[0]
        if (oldTrack) {
          localStream.removeTrack(oldTrack)
          oldTrack.stop()
        }
        localStream.addTrack(newTrack)
        await replaceTrack('audio', newTrack)
      }
    } catch {
      setError('Không thể chuyển đổi micro.')
    }
  }

  // Copy invitation link
  const copyInvite = async (id = room?.id, roomMode = room?.mode, title = room?.name) => {
    if (!id) return
    const mode = roomMode ?? 'group'
    const roleParam = mode === 'live' ? '&role=viewer' : ''
    const titleParam = title ? `&name=${encodeURIComponent(title)}` : ''
    const invite = `${window.location.origin}/?room=${encodeURIComponent(id)}&mode=${mode}${titleParam}${roleParam}`
    try {
      await navigator.clipboard.writeText(invite)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2200)
    } catch {
      setError('Không thể tự động sao chép. Hãy copy đường dẫn từ thanh địa chỉ.')
    }
  }

  // Favorite & history management
  const handleToggleFavorite = (id: string, event?: React.MouseEvent) => {
    event?.stopPropagation()
    const next = toggleFavoriteRoom(id)
    setRoomHistory(next)
  }

  const handleDeleteHistory = (id: string, event?: React.MouseEvent) => {
    event?.stopPropagation()
    const next = deleteRoomHistory(id)
    setRoomHistory(next)
  }

  // Filtered rooms
  const filteredHistory = useMemo(() => {
    return roomHistory.filter((item) => {
      const matchesSearch =
        `${item.name} ${item.id}`.toLowerCase().includes(searchQuery.trim().toLowerCase())
      if (!matchesSearch) return false

      if (activeFilter === 'favorites') return item.isFavorite
      if (activeFilter === 'all') return true
      return item.mode === activeFilter
    })
  }, [activeFilter, roomHistory, searchQuery])

  // Favorite rooms list for right-rail
  const favoriteRooms = useMemo(() => {
    return roomHistory.filter((r) => r.isFavorite)
  }, [roomHistory])

  // In-call UI view
  if (room) {
    return (
      <main className="live-shell">
        <header className="live-header">
          <button className="brand compact" onClick={leave} aria-label="Quay về trang chủ">
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
              onClick={() => void copyInvite(room.id, room.mode, room.name)}
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

        {(notice || error || roomError) && (
          <div className="room-alert" role="status">
            {roomError || error || notice}
            <button
              onClick={() => {
                setNotice('')
                setError('')
              }}
              aria-label="Đóng thông báo"
            >
              <X size={15} />
            </button>
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
            }`}
            aria-label="Phòng họp trực tiếp"
          >
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

            {!localStream && participants.length === 0 && (
              <div className="waiting-panel">
                <div className="waiting-orbit">
                  <div className={`avatar avatar-${profile.avatarColor}`}>{initials(profile.name)}</div>
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
                  onClick={() => void copyInvite(room.id, room.mode, room.name)}
                >
                  <Link2 size={16} /> Sao chép liên kết mời
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
                  onClick={() => void copyInvite(room.id, room.mode, room.name)}
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
                          {initials(profile.name)}
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
                          <span className="avatar avatar-mint">{initials(p.name)}</span>
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
                      );
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
                        sendChatMessage(chatInput)
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
                      onChange={(e) => void handleSwitchAudioDevice(e.target.value)}
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
                      onChange={(e) => void handleSwitchVideoDevice(e.target.value)}
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
                onClick={toggleMic}
                title={isMuted ? 'Bật micro' : 'Tắt micro'}
              >
                {isMuted ? <MicOff /> : <Mic />}
                <span>{isMuted ? 'Bật tiếng' : 'Tắt tiếng'}</span>
              </button>
            )}

            {room.role === 'host' && (
              <button
                className={`control-button ${!cameraOn ? 'is-off' : ''}`}
                onClick={toggleCamera}
                title={cameraOn ? 'Tắt camera' : 'Bật camera'}
              >
                {cameraOn ? <Video /> : <VideoOff />}
                <span>{cameraOn ? 'Dừng video' : 'Bật video'}</span>
              </button>
            )}

            {room.role === 'host' && (
              <button
                className={`control-button ${screenStream ? 'is-off' : ''}`}
                onClick={() => (screenStream ? stopScreenShare() : void shareScreen())}
                title={screenStream ? 'Dừng chia sẻ màn hình' : 'Chia sẻ màn hình'}
              >
                <MonitorUp />
                <span>{screenStream ? 'Dừng chia sẻ' : 'Chia sẻ'}</span>
              </button>
            )}

            <button
              className={`control-button ${localHandRaised ? 'is-off' : ''}`}
              onClick={toggleHandRaise}
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
                        sendReaction(emoji)
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

            <button
              className="control-button"
              onClick={() => void copyInvite(room.id, room.mode, room.name)}
              title="Mời thành viên"
            >
              <Copy />
              <span>Mời</span>
            </button>

            <button className="leave-button" onClick={leave} title="Rời phòng">
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

  // Dashboard View
  return (
    <div className="app-shell">
      {/* Sidebar */}
      <aside className="sidebar">
        <button className="brand" aria-label="Gặp nhau trang chủ">
          <span className="brand-mark">
            <AudioLines size={19} />
          </span>
          <span>gặp nhau</span>
        </button>

        {/* Real User Profile Card */}
        <div
          className="profile-switch"
          onClick={() => setProfileDialog(true)}
          role="button"
          tabIndex={0}
          title="Bấm để chỉnh sửa hồ sơ"
        >
          <span className={`avatar avatar-${profile.avatarColor}`}>{initials(profile.name)}</span>
          <span>
            <strong>{profile.name}</strong>
            <small>{profile.statusText}</small>
          </span>
          <Settings2 size={16} />
        </div>

        {/* Navigation Categories */}
        <nav className="main-nav" aria-label="Điều hướng chính">
          <span className="nav-heading">DANH MỤC</span>
          <button
            className={`nav-item ${activeFilter === 'all' ? 'active' : ''}`}
            onClick={() => setActiveFilter('all')}
          >
            <span className="nav-icon">
              <AudioLines size={18} />
            </span>
            Tất cả phòng <span className="nav-count">{roomHistory.length}</span>
          </button>
          <button
            className={`nav-item ${activeFilter === 'favorites' ? 'active' : ''}`}
            onClick={() => setActiveFilter('favorites')}
          >
            <span className="nav-icon">
              <Star size={18} />
            </span>
            Yêu thích <span className="nav-count">{favoriteRooms.length}</span>
          </button>
          <button
            className={`nav-item ${activeFilter === 'group' ? 'active' : ''}`}
            onClick={() => setActiveFilter('group')}
          >
            <span className="nav-icon">
              <Users size={18} />
            </span>
            Gọi nhóm
          </button>
          <button
            className={`nav-item ${activeFilter === 'live' ? 'active' : ''}`}
            onClick={() => setActiveFilter('live')}
          >
            <span className="nav-icon">
              <Radio size={18} />
            </span>
            Livestream <span className="nav-live" />
          </button>

          {favoriteRooms.length > 0 && (
            <>
              <span className="nav-heading nav-heading-spaced">GHIM NHANH</span>
              {favoriteRooms.slice(0, 3).map((fav) => (
                <button
                  key={fav.id}
                  className="recent-room"
                  onClick={() => void openRoom(fav.mode, fav.id, fav.role, fav.name)}
                >
                  <span className="room-avatar violet">
                    {fav.mode === 'live' ? <Radio size={14} /> : <Users size={14} />}
                  </span>
                  <span>
                    <strong>{fav.name}</strong>
                    <small>{fav.id}</small>
                  </span>
                  <ArrowRight size={13} />
                </button>
              ))}
            </>
          )}
        </nav>

        <div className="sidebar-bottom">
          <button className="help-link" onClick={() => setSettingsDialog(true)}>
            <Settings2 size={16} /> Kiểm tra micro & camera
          </button>
          <button
            className="help-link"
            onClick={() =>
              setNotice(
                'Ứng dụng hỗ trợ kết nối trực tiếp ngang hàng WebRTC (P2P Mesh). Không cần tài khoản, dữ liệu cuộc gọi truyền thẳng giữa các máy!',
              )
            }
          >
            <CircleHelp size={16} /> Trợ giúp & Công nghệ
          </button>
          <div className="sidebar-user">
            <span className={`avatar avatar-${profile.avatarColor}`}>{initials(profile.name)}</span>
            <span>
              <strong>{profile.name}</strong>
              <small>Trực tuyến</small>
            </span>
            <button
              aria-label="Cài đặt hồ sơ"
              className="plain-icon"
              onClick={() => setProfileDialog(true)}
            >
              <Settings2 size={15} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Workspace */}
      <main className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Không gian cá nhân</span>
            <ArrowRight size={13} />
            <strong>
              {activeFilter === 'all'
                ? 'Tất cả phòng'
                : activeFilter === 'favorites'
                ? 'Phòng yêu thích'
                : activeFilter === 'group'
                ? 'Gọi nhóm'
                : 'Livestream'}
            </strong>
          </div>
          <div className="topbar-actions">
            <label className="search-box">
              <Search size={16} />
              <input
                aria-label="Tìm kiếm phòng"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm phòng theo tên hoặc mã..."
              />
              <kbd>⌘ K</kbd>
            </label>
            <button
              className="icon-button notification-button"
              aria-label="Thông báo"
              onClick={() => setNotice('Bạn không có thông báo mới.')}
            >
              <Bell size={18} />
              <i />
            </button>
            <button
              className={`avatar avatar-${profile.avatarColor} top-avatar`}
              aria-label="Đổi thông tin hồ sơ"
              onClick={() => setProfileDialog(true)}
            >
              {initials(profile.name)}
            </button>
          </div>
        </header>

        <div className="workspace-content">
          <section className="welcome-row">
            <div>
              <p className="date-label">KHÔNG GIAN LÀM VIỆC & KẾT NỐI</p>
              <h1>
                Xin chào, {profile.name} <span>✦</span>
              </h1>
              <p className="welcome-subtitle">Bắt đầu phòng họp mới hoặc chọn lại phòng đã lưu bên dưới.</p>
            </div>
            <button className="edit-name" onClick={() => setProfileDialog(true)}>
              Chỉnh sửa hồ sơ
            </button>
          </section>

          {/* Action Cards */}
          <section className="start-grid" aria-label="Bắt đầu kết nối">
            <button
              className="start-card start-primary"
              onClick={() => {
                setNewRoomName('')
                setNewRoomCode('')
                setSelectedMode('group')
                setCreateDialog(true)
              }}
            >
              <span className="start-symbol">
                <Video size={20} />
              </span>
              <span className="start-copy">
                <strong>Tạo phòng mới</strong>
                <small>Bắt đầu cuộc gọi nhóm, 1:1 hoặc livestream</small>
              </span>
              <span className="round-arrow">
                <ArrowRight size={17} />
              </span>
              <span className="start-watermark">
                <AudioLines size={90} />
              </span>
            </button>

            <form
              className="start-card join-card"
              onSubmit={(e) => {
                e.preventDefault()
                if (joinCode.trim()) {
                  // Handle if user pastes full URL or raw code
                  let code = joinCode.trim()
                  if (code.includes('room=')) {
                    const match = code.match(/room=([A-Za-z0-9_-]+)/)
                    if (match) code = match[1]
                  }
                  void openRoom('group', code.toUpperCase())
                }
              }}
            >
              <span className="start-symbol join-symbol">
                <Link2 size={19} />
              </span>
              <span className="start-copy">
                <strong>Tham gia bằng mã hoặc link</strong>
                <small>Nhập mã phòng hoặc dán liên kết mời</small>
              </span>
              <label className="join-input-wrap">
                <span className="sr-only">Mã phòng</span>
                <input
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  placeholder="VD: STANDUP hoặc link đầy đủ..."
                />
                <button type="submit" disabled={!joinCode.trim()} aria-label="Tham gia phòng">
                  <ArrowRight size={16} />
                </button>
              </label>
            </form>
          </section>

          {(error || notice) && (
            <div className="inline-alert" role="alert">
              {error || notice}
              <button
                onClick={() => {
                  setError('')
                  setNotice('')
                }}
                aria-label="Đóng"
              >
                <X size={15} />
              </button>
            </div>
          )}

          {/* Real Room History Section (Zero Mock Data) */}
          <section className="section-block">
            <div className="section-heading">
              <div>
                <h2>Lịch sử phòng & Đã lưu</h2>
                <p>Quản lý các phòng bạn đã tạo hoặc từng tham gia gần đây</p>
              </div>
              <button
                className="text-link"
                onClick={() => {
                  setNewRoomName('')
                  setNewRoomCode('')
                  setSelectedMode('group')
                  setCreateDialog(true)
                }}
              >
                <Plus size={14} /> Tạo phòng mới
              </button>
            </div>

            <div className="activity-list">
              {filteredHistory.map((item) => (
                <div
                  key={item.id}
                  className="activity-row"
                  onClick={() => void openRoom(item.mode, item.id, item.role, item.name)}
                  role="button"
                  tabIndex={0}
                >
                  <span className={`activity-avatar ${item.mode === 'live' ? 'violet' : 'coral'}`}>
                    {item.mode === 'live' ? <Radio size={16} /> : <Users size={16} />}
                  </span>

                  <span className="activity-info">
                    <strong>{item.name}</strong>
                    <small>Mã phòng: {item.id}</small>
                  </span>

                  <span className="activity-time">{formatTimeAgo(item.lastVisited)}</span>

                  <span className="activity-type">
                    {item.mode === 'live' ? (
                      <>
                        <Radio size={13} /> Livestream
                      </>
                    ) : item.mode === 'call' ? (
                      <>
                        <Video size={13} /> Gọi 1:1
                      </>
                    ) : (
                      <>
                        <Users size={13} /> Gọi nhóm
                      </>
                    )}
                  </span>

                  <div className="activity-actions" onClick={(e) => e.stopPropagation()}>
                    <button
                      className={`action-btn-star ${item.isFavorite ? 'is-fav' : ''}`}
                      onClick={(e) => handleToggleFavorite(item.id, e)}
                      title={item.isFavorite ? 'Bỏ yêu thích' : 'Thêm vào yêu thích'}
                    >
                      <Star size={15} fill={item.isFavorite ? 'currentColor' : 'none'} />
                    </button>
                    <button
                      className="action-btn-copy"
                      onClick={() => void copyInvite(item.id, item.mode, item.name)}
                      title="Sao chép liên kết mời"
                    >
                      <Copy size={15} />
                    </button>
                    <button
                      className="action-btn-delete"
                      onClick={(e) => handleDeleteHistory(item.id, e)}
                      title="Xóa khỏi lịch sử"
                    >
                      <Trash2 size={15} />
                    </button>
                    <button
                      className="activity-join"
                      onClick={() => void openRoom(item.mode, item.id, item.role, item.name)}
                    >
                      Vào <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              ))}

              {filteredHistory.length === 0 && (
                <div className="activity-empty">
                  <AudioLines size={32} />
                  <strong>Chưa có phòng nào trong danh sách</strong>
                  <p>
                    {searchQuery
                      ? 'Không tìm thấy phòng phù hợp với từ khóa.'
                      : activeFilter === 'favorites'
                      ? 'Bạn chưa đánh dấu sao phòng nào. Hãy gắn dấu sao để truy cập nhanh!'
                      : 'Hãy tạo phòng mới hoặc tham gia bằng mã ở trên để bắt đầu kết nối!'}
                  </p>
                  <button
                    className="button button-soft"
                    onClick={() => {
                      setNewRoomName('')
                      setNewRoomCode('')
                      setSelectedMode('group')
                      setCreateDialog(true)
                    }}
                  >
                    Tạo phòng ngay
                  </button>
                </div>
              )}
            </div>
          </section>

          <div className="workspace-footnote">
            <ShieldCheck size={14} /> Cuộc gọi được kết nối trực tiếp ngang hàng (P2P Mesh WebRTC) <span>·</span>
            <button
              onClick={() =>
                setNotice(
                  'Dữ liệu video và âm thanh truyền trực tiếp giữa các thiết bị thông qua STUN server công cộng của Google. Bảo mật cao, không lưu trữ trên máy chủ.',
                )
              }
            >
              Tìm hiểu công nghệ
            </button>
          </div>
        </div>
      </main>

      {/* Right Rail: Real favorites, device check & network stats */}
      <aside className="right-rail">
        <div className="rail-top">
          <span>Tiện ích nhanh</span>
        </div>

        {/* Favorite rooms quick access */}
        <section className="rail-section">
          <div className="rail-section-heading">
            <h3>Phòng đã lưu ({favoriteRooms.length})</h3>
            <button
              className="plain-icon"
              title="Tạo phòng mới"
              onClick={() => {
                setNewRoomName('')
                setNewRoomCode('')
                setCreateDialog(true)
              }}
            >
              <Plus size={16} />
            </button>
          </div>

          {favoriteRooms.length === 0 ? (
            <p className="rail-empty-hint">Bấm vào biểu tượng ngôi sao ở danh sách phòng để ghim tại đây.</p>
          ) : (
            favoriteRooms.map((fav) => (
              <div key={fav.id} className="fav-quick-row">
                <button
                  className="fav-quick-button"
                  onClick={() => void openRoom(fav.mode, fav.id, fav.role, fav.name)}
                >
                  <span className="room-avatar violet">
                    {fav.mode === 'live' ? <Radio size={14} /> : <Users size={14} />}
                  </span>
                  <span>
                    <strong>{fav.name}</strong>
                    <small>{fav.id}</small>
                  </span>
                </button>
                <button
                  className="plain-icon mini-icon"
                  onClick={() => void copyInvite(fav.id, fav.mode, fav.name)}
                  title="Sao chép liên kết"
                >
                  <Copy size={13} />
                </button>
              </div>
            ))
          )}
        </section>

        {/* Quick Device Check & Mic Meter */}
        <section className="rail-section">
          <div className="rail-section-heading">
            <h3>Kiểm tra thiết bị</h3>
            <button className="plain-icon" onClick={() => setSettingsDialog(true)} title="Cài đặt">
              <Settings2 size={15} />
            </button>
          </div>

          <div className="device-status-card">
            <div className="device-item">
              <Mic size={14} />
              <span>{devices.audioInputs.length} Micro khả dụng</span>
            </div>
            <div className="device-item">
              <Video size={14} />
              <span>{devices.videoInputs.length} Camera khả dụng</span>
            </div>
            <button className="button button-outline full-width" onClick={() => setSettingsDialog(true)}>
              Kiểm tra âm thanh & hình ảnh
            </button>
          </div>
        </section>

        {/* Invite Banner */}
        <button
          className="invite-banner"
          onClick={() => {
            const code = crypto.randomUUID().slice(0, 8).toUpperCase()
            void copyInvite(code, 'group', `Phòng họp của ${profile.name}`)
          }}
        >
          <span>
            <Sparkles size={18} />
          </span>
          <span>
            <strong>Tạo link mời nhanh</strong>
            <small>Tạo mã và sao chép link gửi cho đồng nghiệp hoặc bạn bè.</small>
          </span>
          <ArrowRight size={15} />
        </button>

        <div className="rail-bottom">
          <span>gặp nhau · WebRTC P2P</span>
          <button
            className="plain-icon"
            aria-label="Trợ giúp"
            onClick={() =>
              setNotice(
                'Ứng dụng hoạt động dựa trên WebRTC chuẩn w3c, phù hợp cho nhóm họp trực tiếp không cần đăng ký tài khoản.',
              )
            }
          >
            <CircleHelp size={15} />
          </button>
        </div>
      </aside>

      {/* Modal: Create Room */}
      {createDialog && (
        <div
          className="dialog-backdrop"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setCreateDialog(false)
          }}
        >
          <section
            className="create-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-title"
          >
            <header>
              <span className="dialog-icon">
                <Video size={19} />
              </span>
              <button className="plain-icon" onClick={() => setCreateDialog(false)} aria-label="Đóng">
                <X size={18} />
              </button>
            </header>
            <h2 id="create-title">Bắt đầu phòng mới</h2>
            <p>Chọn hình thức và thông tin phòng bạn muốn tổ chức.</p>

            <div className="form-group">
              <label>Tên hoặc chủ đề cuộc họp</label>
              <input
                className="modal-input"
                placeholder={`Ví dụ: Họp nhóm ${profile.name}, Trao đổi dự án...`}
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Mã phòng tùy chọn (để trống nếu muốn tạo ngẫu nhiên)</label>
              <input
                className="modal-input"
                placeholder="VD: SPRINT-01"
                value={newRoomCode}
                onChange={(e) => setNewRoomCode(e.target.value.toUpperCase())}
              />
            </div>

            <div className="mode-options">
              {(
                [
                  ['group', Users, 'Gọi nhóm', 'Gặp mặt cùng bạn bè, đồng nghiệp'],
                  ['call', Video, 'Gọi riêng 1:1', 'Trò chuyện trực tiếp 2 người'],
                  ['live', Radio, 'Livestream', 'Phát video trực tiếp cho người xem'],
                ] as const
              ).map(([mode, Icon, title, description]) => (
                <button
                  key={mode}
                  className={`mode-option ${selectedMode === mode ? 'selected' : ''}`}
                  onClick={() => setSelectedMode(mode)}
                >
                  <span className="mode-icon">
                    <Icon size={18} />
                  </span>
                  <span>
                    <strong>{title}</strong>
                    <small>{description}</small>
                  </span>
                  <span className="radio-check">{selectedMode === mode && <Check size={12} />}</span>
                </button>
              ))}
            </div>

            <footer>
              <button className="button button-outline" onClick={() => setCreateDialog(false)}>
                Hủy bỏ
              </button>
              <button
                className="button button-primary"
                onClick={() =>
                  void openRoom(
                    selectedMode,
                    newRoomCode.trim() || undefined,
                    'host',
                    newRoomName.trim() || undefined,
                  )
                }
                disabled={busy}
              >
                {busy ? 'Đang chuẩn bị...' : 'Bắt đầu phòng'} {!busy && <ArrowRight size={15} />}
              </button>
            </footer>
          </section>
        </div>
      )}

      {/* Modal: Edit Profile */}
      {profileDialog && (
        <div
          className="dialog-backdrop"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setProfileDialog(false)
          }}
        >
          <section className="create-dialog" role="dialog" aria-modal="true">
            <header>
              <span className="dialog-icon">
                <Settings2 size={19} />
              </span>
              <button className="plain-icon" onClick={() => setProfileDialog(false)} aria-label="Đóng">
                <X size={18} />
              </button>
            </header>
            <h2>Cài đặt hồ sơ cá nhân</h2>
            <p>Thông tin này sẽ hiển thị khi bạn tham gia vào các phòng video.</p>

            <div className="form-group">
              <label>Tên hiển thị của bạn</label>
              <input
                className="modal-input"
                value={profile.name}
                onChange={(e) => handleUpdateProfile({ name: e.target.value })}
                placeholder="Nhập tên..."
              />
            </div>

            <div className="form-group">
              <label>Trạng thái hiển thị</label>
              <input
                className="modal-input"
                value={profile.statusText}
                onChange={(e) => handleUpdateProfile({ statusText: e.target.value })}
                placeholder="Ví dụ: Sẵn sàng kết nối, Đang bận..."
              />
            </div>

            <div className="form-group">
              <label>Màu đại diện</label>
              <div className="color-palette-grid">
                {AVATAR_COLORS.map((c) => (
                  <button
                    key={c.id}
                    className={`palette-choice avatar avatar-${c.id} ${
                      profile.avatarColor === c.id ? 'is-selected' : ''
                    }`}
                    onClick={() => handleUpdateProfile({ avatarColor: c.id })}
                  >
                    {profile.avatarColor === c.id && <Check size={14} />}
                  </button>
                ))}
              </div>
            </div>

            <footer>
              <button className="button button-primary" onClick={() => setProfileDialog(false)}>
                Hoàn tất
              </button>
            </footer>
          </section>
        </div>
      )}

      {/* Modal: Settings & Device Check */}
      {settingsDialog && (
        <div
          className="dialog-backdrop"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSettingsDialog(false)
          }}
        >
          <section className="create-dialog" role="dialog" aria-modal="true">
            <header>
              <span className="dialog-icon">
                <Volume2 size={19} />
              </span>
              <button className="plain-icon" onClick={() => setSettingsDialog(false)} aria-label="Đóng">
                <X size={18} />
              </button>
            </header>
            <h2>Kiểm tra thiết bị</h2>
            <p>Chọn và kiểm tra microphone, camera trước khi vào phòng.</p>

            <div className="form-group">
              <label>Microphone</label>
              <select
                className="modal-select"
                value={selectedAudioId}
                onChange={(e) => setSelectedAudioId(e.target.value)}
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
                onChange={(e) => setSelectedVideoId(e.target.value)}
              >
                {devices.videoInputs.length === 0 && <option value="">Mặc định của hệ thống</option>}
                {devices.videoInputs.map((d, i) => (
                  <option key={d.deviceId || i} value={d.deviceId}>
                    {d.label || `Camera ${i + 1}`}
                  </option>
                ))}
              </select>
            </div>

            <footer>
              <button className="button button-primary" onClick={() => setSettingsDialog(false)}>
                Đóng
              </button>
            </footer>
          </section>
        </div>
      )}

      {copied && (
        <div className="toast">
          <Check size={16} /> Đã sao chép liên kết mời
        </div>
      )}
      {busy && (
        <div className="busy-screen">
          <span className="spinner" />
          <strong>Đang chuẩn bị phòng...</strong>
        </div>
      )}
    </div>
  )
}

export default App
