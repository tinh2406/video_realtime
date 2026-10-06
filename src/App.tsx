import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  AudioLines,
  Bell,
  Check,
  CircleHelp,
  Copy,
  Link2,
  Mic,
  MicOff,
  MonitorUp,
  Plus,
  Radio,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Users,
  Video,
  VideoOff,
  Volume2,
  X,
} from 'lucide-react'
import { type RoomMode, useRoom } from './useRoom'

type RoomState = { id: string; mode: RoomMode; role: 'host' | 'viewer' }
type Activity = { initials: string; color: string; title: string; detail: string; time: string; mode: RoomMode; id: string }

const initials = (name: string) => name.trim().split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase() || 'G'
const modeLabels: Record<RoomMode, string> = { call: 'Cuộc gọi 1:1', group: 'Gọi nhóm', live: 'Livestream' }

function VideoSurface({ stream, muted = false, label, className = '' }: { stream: MediaStream | null; muted?: boolean; label: string; className?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream
  }, [stream])
  return (
    <div className={`video-surface ${className}`}>
      {stream?.getVideoTracks().length ? (
        <video ref={videoRef} autoPlay playsInline muted={muted} />
      ) : (
        <div className="video-placeholder"><span>{initials(label)}</span></div>
      )}
      <span className="video-name">{label}</span>
    </div>
  )
}

function App() {
  const [displayName, setDisplayName] = useState(() => localStorage.getItem('meet-display-name') || 'Minh Anh')
  const [room, setRoom] = useState<RoomState | null>(null)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [isMuted, setIsMuted] = useState(false)
  const [cameraOn, setCameraOn] = useState(true)
  const [roomDialog, setRoomDialog] = useState(false)
  const [selectedMode, setSelectedMode] = useState<RoomMode>('group')
  const [joinCode, setJoinCode] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const autoJoined = useRef(false)
  const parsedRoom = new URLSearchParams(window.location.search).get('room')
  const queryMode = new URLSearchParams(window.location.search).get('mode')
  const queryRole = new URLSearchParams(window.location.search).get('role')

  useEffect(() => {
    localStorage.setItem('meet-display-name', displayName)
  }, [displayName])

  const { participants, connectionState, roomError, leaveRoom, screenStream, shareScreen } = useRoom(room?.id ?? null, room?.mode ?? 'group', displayName, localStream)

  const openRoom = useCallback(async (mode: RoomMode, id?: string, role: 'host' | 'viewer' = 'host') => {
    if (busy) return
    setBusy(true)
    setError('')
    setNotice('')
    const roomId = id?.trim() || crypto.randomUUID().slice(0, 8).toUpperCase()
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(roomId)) {
      setError('Mã phòng chỉ được có chữ cái, số, dấu gạch ngang hoặc gạch dưới.')
      setBusy(false)
      return
    }
    let stream: MediaStream | null = null
    if (role === 'host') {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: mode !== 'live' || role === 'host',
        })
        setIsMuted(false)
        setCameraOn(true)
      } catch (cause) {
        const message = cause instanceof Error && cause.name === 'NotAllowedError'
          ? 'Bạn chưa cấp quyền camera hoặc micro. Có thể tiếp tục vào phòng và bật lại trong cài đặt trình duyệt.'
          : 'Không truy cập được camera hoặc micro. Bạn vẫn có thể vào phòng để nghe và xem người khác.'
        setNotice(message)
      }
    }
    setLocalStream(stream)
    setRoom({ id: roomId, mode, role })
    setRoomDialog(false)
    window.history.replaceState({}, '', `?room=${encodeURIComponent(roomId)}&mode=${mode}${role === 'viewer' ? '&role=viewer' : ''}`)
    setBusy(false)
  }, [busy])

  useEffect(() => {
    if (parsedRoom && !autoJoined.current) {
      autoJoined.current = true
      const mode: RoomMode = queryMode === 'live' ? 'live' : queryMode === 'call' ? 'call' : 'group'
      void openRoom(mode, parsedRoom, queryRole === 'viewer' ? 'viewer' : 'host')
    }
  }, [openRoom, parsedRoom, queryMode, queryRole])

  const leave = () => {
    leaveRoom()
    localStream?.getTracks().forEach((track) => track.stop())
    screenStream?.getTracks().forEach((track) => track.stop())
    setLocalStream(null)
    setRoom(null)
    window.history.replaceState({}, '', window.location.pathname)
  }

  const getMediaStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true })
      setLocalStream(stream)
      setNotice('')
      return stream
    } catch {
      setNotice('Không truy cập được camera hoặc micro. Hãy cấp quyền trong trình duyệt rồi thử lại.')
      return null
    }
  }
  const toggleMic = async () => {
    const next = !isMuted
    const stream = localStream ?? await getMediaStream()
    stream?.getAudioTracks().forEach((track) => { track.enabled = !next })
    setIsMuted(next)
  }
  const toggleCamera = async () => {
    const next = !cameraOn
    const stream = localStream ?? await getMediaStream()
    stream?.getVideoTracks().forEach((track) => { track.enabled = !next })
    setCameraOn(next)
  }
  const copyInvite = async (id = room?.id) => {
    if (!id) return
    const mode = room?.mode ?? selectedMode
    const role = mode === 'live' ? '&role=viewer' : ''
    const invite = `${window.location.origin}/?room=${encodeURIComponent(id)}&mode=${mode}${role}`
    try {
      await navigator.clipboard.writeText(invite)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setError('Không thể sao chép liên kết. Hãy sao chép đường dẫn trên thanh địa chỉ.')
    }
  }
  const startActivity = (activity: Activity) => {
    const role = activity.mode === 'live' ? 'viewer' : 'host'
    void openRoom(activity.mode, activity.id, role)
  }
  const startScreenShare = async () => {
    try {
      await shareScreen()
    } catch (cause) {
      setNotice(cause instanceof Error && cause.name === 'NotAllowedError'
        ? 'Bạn đã hủy chia sẻ màn hình.'
        : 'Không thể chia sẻ màn hình. Hãy kiểm tra quyền trình duyệt và thử lại.')
    }
  }
  const stopScreenShare = () => {
    screenStream?.getTracks().forEach((track) => track.stop())
  }
  const editDisplayName = () => {
    const nextName = window.prompt('Tên hiển thị của bạn', displayName)
    if (nextName?.trim()) setDisplayName(nextName.trim())
  }

  if (room) {
    return (
      <main className="live-shell">
        <header className="live-header">
          <button className="brand compact" onClick={leave} aria-label="Quay về trang chủ"><span className="brand-mark"><AudioLines size={19} /></span><span>gặp nhau</span></button>
          <div className="live-room-name"><span className={`live-indicator ${connectionState.includes('Mất') || connectionState.includes('Đã rời') ? 'is-offline' : ''}`} />{modeLabels[room.mode]} <span className="room-code">{room.id}</span></div>
          <div className="live-header-actions">
            <span className="secure-label"><ShieldCheck size={15} /> Kết nối trực tiếp</span>
          </div>
        </header>
        {(notice || error || roomError) && <div className="room-alert" role="status">{roomError || error || notice}<button onClick={() => { setNotice(''); setError('') }} aria-label="Đóng thông báo"><X size={16} /></button></div>}
        <section className={`call-stage ${participants.length + (localStream && room.role === 'host' ? 1 : 0) > 1 ? 'has-guests' : ''}`} aria-label="Phòng video">
          {localStream && room.role === 'host' && <VideoSurface stream={cameraOn ? screenStream ?? localStream : null} muted label={`${displayName} (Bạn)`} className="self-tile" />}
          {participants.map((participant) => <VideoSurface key={participant.id} stream={participant.stream} label={participant.name} />)}
          {!localStream && participants.length === 0 && (
            <div className="waiting-panel">
              <div className="waiting-orbit"><div className="avatar avatar-blue">{initials(displayName)}</div><i /><i /><i /></div>
              <h1>{room.role === 'viewer' ? 'Đang chờ livestream' : 'Phòng đã sẵn sàng'}</h1>
              <p>{room.role === 'viewer' ? 'Người phát sẽ xuất hiện ở đây khi bắt đầu truyền video.' : 'Chia sẻ mã phòng để mọi người có thể tham gia cùng bạn.'}</p>
              <button className="button button-primary" onClick={() => void copyInvite()}><Link2 size={17} /> Sao chép liên kết mời</button>
            </div>
          )}
          {localStream && participants.length === 0 && (
            <div className="empty-call">
              <div className="empty-dot"><span /></div>
              <strong>Đang chờ mọi người tham gia</strong>
              <span>Gửi lời mời để bắt đầu trò chuyện</span>
              <button className="button button-soft" onClick={() => void copyInvite()}><Copy size={16} /> Sao chép liên kết</button>
            </div>
          )}
          <div className="connection-pill"><span className={connectionState.includes('Mất') ? 'connection-dot danger' : 'connection-dot'} />{connectionState}</div>
        </section>
        <footer className="call-footer">
          <div className="footer-room"><span className="room-avatar"><Users size={17} /></span><span><strong>{modeLabels[room.mode]}</strong><small>{participants.length + (localStream ? 1 : 0)} người trong phòng</small></span></div>
          <div className="call-controls">
            {room.role === 'host' && <button className={`control-button ${isMuted ? 'is-off' : ''}`} onClick={toggleMic} aria-label={isMuted ? 'Bật micro' : 'Tắt micro'} title={isMuted ? 'Bật micro' : 'Tắt micro'}>{isMuted ? <MicOff /> : <Mic />}<span>{isMuted ? 'Bật tiếng' : 'Tắt tiếng'}</span></button>}
            {room.role === 'host' && <button className={`control-button ${!cameraOn ? 'is-off' : ''}`} onClick={toggleCamera} aria-label={cameraOn ? 'Tắt camera' : 'Bật camera'} title={cameraOn ? 'Tắt camera' : 'Bật camera'}>{cameraOn ? <Video /> : <VideoOff />}<span>{cameraOn ? 'Dừng video' : 'Bật video'}</span></button>}
            <button className="control-button" onClick={() => void copyInvite()} aria-label="Sao chép liên kết mời" title="Mời thành viên"><Copy /><span>Mời</span></button>
            {room.role === 'host' && <button className={`control-button ${screenStream ? 'is-off' : ''}`} onClick={() => screenStream ? stopScreenShare() : void startScreenShare()} aria-label={screenStream ? 'Dừng chia sẻ màn hình' : 'Chia sẻ màn hình'} title={screenStream ? 'Dừng chia sẻ' : 'Chia sẻ màn hình'}><MonitorUp /><span>{screenStream ? 'Dừng chia sẻ' : 'Chia sẻ màn hình'}</span></button>}
            <button className="leave-button" onClick={leave} aria-label="Rời phòng"><ArrowLeft size={17} /><span>Rời phòng</span></button>
          </div>
          <div className="footer-meta"><span><Users size={16} /> {participants.length + (localStream ? 1 : 0)}</span></div>
        </footer>
      </main>
    )
  }

  const activities: Activity[] = [
    { initials: 'TD', color: 'coral', title: 'Team Daily', detail: 'Linh, Quân + 2 người', time: 'Đang diễn ra', mode: 'group', id: 'TEAMDAILY' },
    { initials: 'SP', color: 'blue', title: 'Sprint planning', detail: 'Họp nhóm · 5 người', time: '10:30', mode: 'group', id: 'SPRINT24' },
    { initials: 'ML', color: 'violet', title: 'Mai Linh đang phát', detail: 'Livestream · 12 người xem', time: 'ĐANG LIVE', mode: 'live', id: 'MAILIVE' },
  ]
  const visibleActivities = activities.filter((activity) =>
    `${activity.title} ${activity.detail} ${activity.id}`.toLowerCase().includes(searchQuery.trim().toLowerCase()),
  )

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand" aria-label="Gặp nhau trang chủ"><span className="brand-mark"><AudioLines size={19} /></span><span>gặp nhau</span></button>
        <div className="profile-switch"><span className="avatar avatar-mint">N</span><span><strong>Nhóm của Minh</strong><small>Không gian cá nhân</small></span></div>
        <nav className="main-nav" aria-label="Điều hướng chính">
          <span className="nav-heading">KHÔNG GIAN</span>
          <button className="nav-item active"><span className="nav-icon"><AudioLines size={18} /></span> Tổng quan</button>
          <button className="nav-item" onClick={() => { setSelectedMode('group'); setRoomDialog(true) }}><span className="nav-icon"><Users size={18} /></span> Phòng của tôi <span className="nav-count">3</span></button>
          <button className="nav-item" onClick={() => { setSelectedMode('live'); setRoomDialog(true) }}><span className="nav-icon"><Radio size={18} /></span> Livestream <span className="nav-live" /></button>
          <span className="nav-heading nav-heading-spaced">GẦN ĐÂY</span>
          {activities.slice(0, 2).map((activity) => <button className="recent-room" key={activity.id} onClick={() => startActivity(activity)}><span className={`room-avatar ${activity.color}`}>{activity.initials}</span><span><strong>{activity.title}</strong><small>{activity.detail}</small></span><ArrowRight size={14} /></button>)}
        </nav>
        <div className="sidebar-bottom">
          <button className="help-link" onClick={() => setNotice('Cuộc gọi nhóm lớn cần máy chủ SFU; bản hiện tại kết nối trực tiếp cho nhóm nhỏ.')}><CircleHelp size={17} /> Trung tâm trợ giúp</button>
          <button className="help-link" onClick={editDisplayName}><Settings2 size={17} /> Cài đặt tên hiển thị</button>
          <div className="sidebar-user"><span className="avatar avatar-photo">{initials(displayName)}</span><span><strong>{displayName}</strong><small>Đang hoạt động</small></span><button aria-label="Đổi tên hiển thị" className="plain-icon" onClick={editDisplayName}><Settings2 size={16} /></button></div>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div className="breadcrumb"><span>Nhóm của Minh</span><ArrowRight size={14} /><strong>Tổng quan</strong></div>
          <div className="topbar-actions">
            <label className="search-box"><Search size={17} /><input aria-label="Tìm kiếm" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Tìm phòng, người..." /><kbd>⌘ K</kbd></label>
            <button className="icon-button notification-button" aria-label="Thông báo" onClick={() => setNotice('Bạn chưa có thông báo mới.')}><Bell size={19} /><i /></button>
            <button className="avatar avatar-photo top-avatar" aria-label="Đổi tên hiển thị" onClick={editDisplayName}>{initials(displayName)}</button>
          </div>
        </header>
        <div className="workspace-content">
          <section className="welcome-row">
            <div><p className="date-label">KHÔNG GIAN CỦA BẠN</p><h1>Xin chào, {displayName.split(' ')[0]} <span>✦</span></h1><p className="welcome-subtitle">Hôm nay bạn muốn kết nối với ai?</p></div>
            <button className="edit-name" onClick={editDisplayName}>Đổi tên hiển thị</button>
          </section>
          <section className="start-grid" aria-label="Bắt đầu kết nối">
            <button className="start-card start-primary" onClick={() => { setSelectedMode('group'); setRoomDialog(true) }}>
              <span className="start-symbol"><Video size={21} /></span>
              <span className="start-copy"><strong>Tạo phòng mới</strong><small>Bắt đầu cuộc gọi hoặc livestream</small></span>
              <span className="round-arrow"><ArrowRight size={18} /></span>
              <span className="start-watermark"><AudioLines size={90} /></span>
            </button>
            <form className="start-card join-card" onSubmit={(event) => { event.preventDefault(); if (joinCode.trim()) void openRoom('group', joinCode.trim().toUpperCase()) }}>
              <span className="start-symbol join-symbol"><Link2 size={20} /></span>
              <span className="start-copy"><strong>Tham gia bằng mã</strong><small>Nhập mã phòng bạn được mời</small></span>
              <label className="join-input-wrap"><span className="sr-only">Mã phòng</span><input value={joinCode} onChange={(event) => setJoinCode(event.target.value)} placeholder="VD: TEAMDAILY" /><button type="submit" disabled={!joinCode.trim()} aria-label="Tham gia phòng"><ArrowRight size={17} /></button></label>
            </form>
          </section>
          {(error || notice) && <div className="inline-alert" role="alert">{error || notice}<button onClick={() => { setError(''); setNotice('') }} aria-label="Đóng"><X size={16} /></button></div>}
          <section className="section-block">
            <div className="section-heading"><div><h2>Phòng mẫu</h2><p>Dữ liệu minh họa · Tạo phòng thật để bắt đầu</p></div><button className="text-link" onClick={() => { setSelectedMode('group'); setRoomDialog(true) }}>Tạo phòng <ArrowRight size={15} /></button></div>
            <div className="activity-list">
              {visibleActivities.map((activity) => <button className={`activity-row ${activity.time === 'Đang diễn ra' || activity.time === 'ĐANG LIVE' ? 'activity-live' : ''}`} key={activity.id} onClick={() => startActivity(activity)}>
                <span className={`activity-avatar ${activity.color}`}>{activity.initials}{activity.mode === 'live' && <i />}</span>
                <span className="activity-info"><strong>{activity.title}</strong><small>{activity.detail}</small></span>
                <span className={`activity-time ${activity.time === 'ĐANG LIVE' ? 'live-text' : ''}`}>{activity.time === 'Đang diễn ra' && <i />}{activity.time}</span>
                <span className="activity-type">{activity.mode === 'live' ? <><Radio size={14} /> Livestream</> : <><Users size={14} /> Gọi nhóm</>}</span>
                <span className="activity-join">Tham gia <ArrowRight size={15} /></span>
              </button>)}
              {visibleActivities.length === 0 && <div className="activity-empty">Không tìm thấy phòng phù hợp. Hãy thử một từ khóa khác.</div>}
            </div>
          </section>
          <div className="workspace-footnote"><ShieldCheck size={14} /> Cuộc gọi được kết nối trực tiếp giữa các thiết bị <span>·</span> <button onClick={() => setNotice('Các cuộc gọi và livestream hiện hỗ trợ nhóm nhỏ qua kết nối peer-to-peer. Phát sóng quy mô lớn cần hệ thống SFU riêng.')}>Tìm hiểu thêm</button></div>
        </div>
      </main>

      <aside className="right-rail">
        <div className="rail-top"><span>Không gian nhóm</span></div>
        <div className="group-profile"><div className="group-art"><span>n</span><i /><i /><i /></div><h2>Nhóm của Minh</h2><p>Mẫu minh họa · Không gian cá nhân</p><div className="group-stats"><span><Users size={15} /> 8 thành viên</span><span><span className="online-dot" /> 3 đang online</span></div></div>
        <section className="rail-section"><div className="rail-section-heading"><h3>Thành viên online</h3><button className="plain-icon" aria-label="Thêm thành viên" onClick={() => void copyInvite('TEAMDAILY')}><Plus size={17} /></button></div>
          <div className="member-row"><span className="avatar avatar-photo">LA<i /></span><span><strong>Linh Anh</strong><small>Đang trong Team Daily</small></span><button className="member-call" aria-label="Gọi Linh Anh" onClick={() => void openRoom('call', 'LINHANH')}><Video size={15} /></button></div>
          <div className="member-row"><span className="avatar avatar-lilac">Q</span><span><strong>Quốc Quân</strong><small>Vừa hoạt động</small></span><button className="member-call" aria-label="Gọi Quốc Quân" onClick={() => void openRoom('call', 'QUOCQUAN')}><Video size={15} /></button></div>
          <div className="member-row"><span className="avatar avatar-peach">M</span><span><strong>Mai Linh</strong><small>Đang livestream</small></span><button className="member-call" aria-label="Xem livestream của Mai Linh" onClick={() => void openRoom('live', 'MAILIVE', 'viewer')}><Volume2 size={15} /></button></div>
          <div className="member-row"><span className="avatar avatar-sky">T</span><span><strong>Tuấn</strong><small>Đang online</small></span><button className="member-call" aria-label="Gọi Tuấn" onClick={() => void openRoom('call', 'TUAN')}><Video size={15} /></button></div>
        </section>
        <section className="rail-section quick-live"><div className="rail-section-heading"><h3>Phòng đang mở</h3><span className="live-count">2 LIVE</span></div><button className="live-room-row" onClick={() => void openRoom('group', 'TEAMDAILY')}><span className="mini-live-art coral-art"><Users size={18} /></span><span><strong>Team Daily</strong><small><i /> 4 người đang gọi</small></span><ArrowRight size={15} /></button><button className="live-room-row" onClick={() => void openRoom('live', 'MAILIVE', 'viewer')}><span className="mini-live-art violet-art"><Radio size={18} /></span><span><strong>Mai Linh đang phát</strong><small><i /> Livestream · 12 người xem</small></span><ArrowRight size={15} /></button></section>
        <button className="invite-banner" onClick={() => void copyInvite('TEAMDAILY')}><span><Sparkles size={18} /></span><span><strong>Mời bạn bè vào nhóm</strong><small>Cùng nhau tạo những cuộc trò chuyện mới.</small></span><ArrowRight size={16} /></button>
        <div className="rail-bottom"><span>gặp nhau · Beta</span><button className="plain-icon" aria-label="Trợ giúp" onClick={() => setNotice('Cuộc gọi nhóm lớn cần máy chủ SFU; bản hiện tại kết nối trực tiếp cho nhóm nhỏ.')}><CircleHelp size={16} /></button></div>
      </aside>

      {roomDialog && <div className="dialog-backdrop" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) setRoomDialog(false) }}>
        <section className="create-dialog" role="dialog" aria-modal="true" aria-labelledby="create-title">
          <header><span className="dialog-icon"><Video size={19} /></span><button className="plain-icon" onClick={() => setRoomDialog(false)} aria-label="Đóng"><X size={19} /></button></header>
          <h2 id="create-title">Bắt đầu một cuộc trò chuyện</h2><p>Chọn cách bạn muốn kết nối hôm nay.</p>
          <div className="mode-options">
            {([
              ['group', Users, 'Gọi nhóm', 'Gặp mặt cùng bạn bè và đồng đội'],
              ['call', Video, 'Gọi riêng', 'Trò chuyện trực tiếp 1:1'],
              ['live', Radio, 'Livestream', 'Phát trực tiếp cho nhóm nhỏ'],
            ] as const).map(([mode, Icon, title, description]) => <button key={mode} className={`mode-option ${selectedMode === mode ? 'selected' : ''}`} onClick={() => setSelectedMode(mode)}><span className="mode-icon"><Icon size={19} /></span><span><strong>{title}</strong><small>{description}</small></span><span className="radio-check">{selectedMode === mode && <Check size={13} />}</span></button>)}
          </div>
          {selectedMode === 'live' && <div className="live-hint"><Radio size={15} /> Livestream hiện hỗ trợ nhóm nhỏ qua WebRTC peer-to-peer.</div>}
          <footer><button className="button button-outline" onClick={() => setRoomDialog(false)}>Để sau</button><button className="button button-primary" onClick={() => void openRoom(selectedMode)} disabled={busy}>{busy ? 'Đang chuẩn bị...' : 'Tạo phòng'} {!busy && <ArrowRight size={16} />}</button></footer>
        </section>
      </div>}
      {copied && <div className="toast"><Check size={16} /> Đã sao chép liên kết mời</div>}
      {busy && <div className="busy-screen"><span className="spinner" /><strong>Đang chuẩn bị phòng...</strong></div>}
    </div>
  )
}

export default App
