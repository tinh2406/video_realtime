import {
  ArrowRight,
  AudioLines,
  Bell,
  CircleHelp,
  Copy,
  Hand,
  Link2,
  Mic,
  MonitorUp,
  Play,
  Plus,
  Radio,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  Users,
  Video,
  X,
} from 'lucide-react'
import { formatTimeAgo } from '../storage'
import type { LiveStreamItem, RoomHistoryItem, RoomMode, UserProfile } from '../types'
import { initials } from './VideoSurface'

interface DashboardViewProps {
  profile: UserProfile
  roomHistory: RoomHistoryItem[]
  favoriteRooms: RoomHistoryItem[]
  filteredHistory: RoomHistoryItem[]
  activeFilter: 'all' | 'favorites' | RoomMode
  searchQuery: string
  joinCode: string
  devices: { audioInputs: MediaDeviceInfo[]; videoInputs: MediaDeviceInfo[] }
  error: string
  notice: string
  liveStreams: LiveStreamItem[]
  onSetActiveFilter: (filter: 'all' | 'favorites' | RoomMode) => void
  onSetSearchQuery: (query: string) => void
  onSetJoinCode: (code: string) => void
  onOpenCreateDialog: (defaultMode?: RoomMode) => void
  onOpenProfileDialog: () => void
  onOpenSettingsDialog: () => void
  onDismissAlert: () => void
  onJoinByCode: (code: string) => void
  onSelectRoom: (item: RoomHistoryItem) => void
  onToggleFavorite: (id: string, e: React.MouseEvent) => void
  onDeleteHistory: (id: string, e: React.MouseEvent) => void
  onCopyInvite: (id: string, mode?: RoomMode, name?: string) => void
  onShowNotice: (msg: string) => void
  onWatchLiveStream: (stream: LiveStreamItem) => void
  onRefreshLiveStreams: () => void
}

export function DashboardView({
  profile,
  roomHistory,
  favoriteRooms,
  filteredHistory,
  activeFilter,
  searchQuery,
  joinCode,
  devices,
  error,
  notice,
  liveStreams,
  onSetActiveFilter,
  onSetSearchQuery,
  onSetJoinCode,
  onOpenCreateDialog,
  onOpenProfileDialog,
  onOpenSettingsDialog,
  onDismissAlert,
  onJoinByCode,
  onSelectRoom,
  onToggleFavorite,
  onDeleteHistory,
  onCopyInvite,
  onShowNotice,
  onWatchLiveStream,
  onRefreshLiveStreams,
}: DashboardViewProps) {
  const groupRoomsCount = roomHistory.filter((r) => r.mode === 'group' || r.mode === 'call').length

  return (
    <div className="app-shell">
      {/* Sidebar */}
      <aside className="sidebar">
        <button className="brand" aria-label="Gặp nhau trang chủ" onClick={() => onSetActiveFilter('all')}>
          <span className="brand-mark">
            <AudioLines size={19} />
          </span>
          <span>gặp nhau</span>
        </button>

        {/* Real User Profile Card */}
        <div
          className="profile-switch"
          onClick={onOpenProfileDialog}
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
            onClick={() => onSetActiveFilter('all')}
          >
            <span className="nav-icon">
              <AudioLines size={18} />
            </span>
            Tất cả phòng <span className="nav-count">{roomHistory.length}</span>
          </button>
          <button
            className={`nav-item ${activeFilter === 'favorites' ? 'active' : ''}`}
            onClick={() => onSetActiveFilter('favorites')}
          >
            <span className="nav-icon">
              <Star size={18} />
            </span>
            Yêu thích <span className="nav-count">{favoriteRooms.length}</span>
          </button>
          <button
            className={`nav-item ${activeFilter === 'group' ? 'active' : ''}`}
            onClick={() => onSetActiveFilter('group')}
          >
            <span className="nav-icon">
              <Users size={18} />
            </span>
            Gọi nhóm <span className="nav-count">{groupRoomsCount}</span>
          </button>
          <button
            className={`nav-item ${activeFilter === 'live' ? 'active' : ''}`}
            onClick={() => onSetActiveFilter('live')}
          >
            <span className="nav-icon">
              <Radio size={18} />
            </span>
            Livestream{' '}
            {liveStreams.length > 0 ? (
              <span className="nav-live-count">{liveStreams.length}</span>
            ) : (
              <span className="nav-live" />
            )}
          </button>

          {favoriteRooms.length > 0 && (
            <>
              <span className="nav-heading nav-heading-spaced">GHIM NHANH</span>
              {favoriteRooms.slice(0, 3).map((fav) => (
                <button
                  key={fav.id}
                  className="recent-room"
                  onClick={() => onSelectRoom(fav)}
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
          <button className="help-link" onClick={onOpenSettingsDialog}>
            <Settings2 size={16} /> Kiểm tra micro & camera
          </button>
          <button
            className="help-link"
            onClick={() =>
              onShowNotice(
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
              onClick={onOpenProfileDialog}
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
                ? 'Gọi nhóm & Hội nghị'
                : 'Sàn Livestream trực tiếp'}
            </strong>
          </div>
          <div className="topbar-actions">
            <label className="search-box">
              <Search size={16} />
              <input
                aria-label="Tìm kiếm phòng"
                value={searchQuery}
                onChange={(e) => onSetSearchQuery(e.target.value)}
                placeholder="Tìm phòng theo tên hoặc mã..."
              />
              <kbd>⌘ K</kbd>
            </label>
            <button
              className="icon-button notification-button"
              aria-label="Thông báo"
              onClick={() => onShowNotice('Bạn không có thông báo mới.')}
            >
              <Bell size={18} />
              <i />
            </button>
            <button
              className={`avatar avatar-${profile.avatarColor} top-avatar`}
              aria-label="Đổi thông tin hồ sơ"
              onClick={onOpenProfileDialog}
            >
              {initials(profile.name)}
            </button>
          </div>
        </header>

        <div className="workspace-content">
          {/* Alerts */}
          {(error || notice) && (
            <div className="inline-alert" role="alert">
              {error || notice}
              <button onClick={onDismissAlert} aria-label="Đóng">
                <X size={15} />
              </button>
            </div>
          )}

          {/* ====================================================
              TAB 1: TẤT CẢ PHÒNG (DASHBOARD TỔNG QUAN)
             ==================================================== */}
          {activeFilter === 'all' && (
            <>
              <section className="welcome-row">
                <div>
                  <p className="date-label">KHÔNG GIAN LÀM VIỆC & KẾT NỐI</p>
                  <h1>
                    Xin chào, {profile.name} <span>✦</span>
                  </h1>
                  <p className="welcome-subtitle">Bắt đầu phòng họp mới hoặc chọn lại phòng đã lưu bên dưới.</p>
                  <div className="stat-chips-row">
                    <span className="stat-chip">
                      <AudioLines size={14} /> Tất cả: <strong>{roomHistory.length} phòng</strong>
                    </span>
                    <span className="stat-chip stat-fav">
                      <Star size={14} /> Yêu thích: <strong>{favoriteRooms.length}</strong>
                    </span>
                    <span className="stat-chip stat-live">
                      <Radio size={14} /> Đang phát sóng: <strong>{liveStreams.length} luồng</strong>
                    </span>
                  </div>
                </div>
                <button className="edit-name" onClick={onOpenProfileDialog}>
                  Chỉnh sửa hồ sơ
                </button>
              </section>

              {/* Action Cards */}
              <section className="start-grid" aria-label="Bắt đầu kết nối">
                <button
                  className="start-card start-primary"
                  onClick={() => onOpenCreateDialog()}
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
                      onJoinByCode(joinCode.trim())
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
                      onChange={(e) => onSetJoinCode(e.target.value)}
                      placeholder="VD: STANDUP hoặc link đầy đủ..."
                    />
                    <button type="submit" disabled={!joinCode.trim()} aria-label="Tham gia phòng">
                      <ArrowRight size={16} />
                    </button>
                  </label>
                </form>
              </section>

              {/* Live Streams Discovery (Preview) */}
              {liveStreams.length > 0 && (
                <section className="section-block live-discovery-block">
                  <div className="section-heading">
                    <div>
                      <div className="section-live-tag">
                        <span className="live-pulse-dot" />
                        <strong>ĐANG PHÁT SÓNG</strong>
                        <span className="live-total-pill">{liveStreams.length} luồng</span>
                      </div>
                      <h2>Khám phá Livestream</h2>
                      <p>Lướt xem các phòng trực tiếp và nhấn vào xem ngay</p>
                    </div>
                    <button className="text-link" onClick={() => onSetActiveFilter('live')}>
                      Xem tất cả luồng live <ArrowRight size={14} />
                    </button>
                  </div>

                  <div className="live-discovery-grid">
                    {liveStreams.slice(0, 2).map((stream) => (
                      <div key={stream.id} className="live-stream-card">
                        <div
                          className="live-card-thumb"
                          onClick={() => onWatchLiveStream(stream)}
                          role="button"
                          tabIndex={0}
                          title="Bấm để vào xem ngay"
                        >
                          <div className="thumb-live-badge">
                            <span className="live-pulse-dot" />
                            <span>LIVE</span>
                          </div>
                          <div className="thumb-viewers-badge">
                            <Users size={12} />
                            <span>{stream.viewersCount}</span>
                          </div>
                          <div className="thumb-center-art">
                            <span className={`avatar avatar-${stream.streamerAvatar || 'violet'}`}>
                              {initials(stream.streamerName)}
                            </span>
                            <div className="thumb-play-overlay">
                              <Play size={24} fill="#fff" />
                              <span>Xem ngay</span>
                            </div>
                          </div>
                          {stream.tag && <span className="thumb-topic-tag">{stream.tag}</span>}
                        </div>
                        <div className="live-card-info">
                          <h3 className="live-card-title" onClick={() => onWatchLiveStream(stream)}>
                            {stream.title}
                          </h3>
                          <div className="live-card-streamer">
                            <span className="streamer-avatar-micro">{initials(stream.streamerName)}</span>
                            <span className="streamer-name">{stream.streamerName}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* All History List */}
              <section className="section-block">
                <div className="section-heading">
                  <div>
                    <h2>Lịch sử phòng & Đã lưu</h2>
                    <p>Quản lý các phòng bạn đã tạo hoặc từng tham gia gần đây</p>
                  </div>
                  <button className="text-link" onClick={() => onOpenCreateDialog()}>
                    <Plus size={14} /> Tạo phòng mới
                  </button>
                </div>

                <div className="activity-list">
                  {filteredHistory.map((item) => (
                    <div
                      key={item.id}
                      className="activity-row"
                      onClick={() => onSelectRoom(item)}
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
                          onClick={(e) => onToggleFavorite(item.id, e)}
                          title={item.isFavorite ? 'Bỏ yêu thích' : 'Thêm vào yêu thích'}
                        >
                          <Star size={15} fill={item.isFavorite ? 'currentColor' : 'none'} />
                        </button>
                        <button
                          className="action-btn-copy"
                          onClick={() => onCopyInvite(item.id, item.mode, item.name)}
                          title="Sao chép liên kết mời"
                        >
                          <Copy size={15} />
                        </button>
                        <button
                          className="action-btn-delete"
                          onClick={(e) => onDeleteHistory(item.id, e)}
                          title="Xóa khỏi lịch sử"
                        >
                          <Trash2 size={15} />
                        </button>
                        <button className="activity-join" onClick={() => onSelectRoom(item)}>
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
                          : 'Hãy tạo phòng mới hoặc tham gia bằng mã ở trên để bắt đầu kết nối!'}
                      </p>
                      <button className="button button-soft" onClick={() => onOpenCreateDialog()}>
                        Tạo phòng ngay
                      </button>
                    </div>
                  )}
                </div>
              </section>
            </>
          )}

          {/* ====================================================
              TAB 2: YÊU THÍCH (DANH SÁCH PHÒNG ĐÃ GHIM DẠNG GRID)
             ==================================================== */}
          {activeFilter === 'favorites' && (
            <>
              <section className="tab-hero-box tab-hero-fav">
                <div>
                  <span className="tab-badge tab-badge-fav">
                    <Star size={12} fill="#fbbf24" /> PHÒNG ĐÃ GHIM ⭐
                  </span>
                  <h1>Phòng yêu thích & Đã lưu</h1>
                  <p className="welcome-subtitle">
                    Không gian lưu trữ các phòng họp định kỳ và kênh quen thuộc để bạn truy cập ngay lập tức chỉ với 1 cú click.
                  </p>
                </div>
                <div className="tab-hero-actions">
                  <button className="button button-soft" onClick={() => onOpenCreateDialog()}>
                    <Plus size={14} /> Tạo phòng mới
                  </button>
                </div>
              </section>

              {favoriteRooms.length > 0 ? (
                <section className="section-block">
                  <div className="section-heading">
                    <div>
                      <h2>Danh sách phòng yêu thích ({favoriteRooms.length})</h2>
                      <p>Bấm vào phòng để vào ngay phòng chờ hoặc sao chép liên kết gửi cho người khác</p>
                    </div>
                  </div>

                  <div className="favorites-grid">
                    {favoriteRooms.map((fav) => (
                      <div key={fav.id} className="fav-card">
                        <div>
                          <div className="fav-card-header">
                            <span className="fav-card-type-tag">
                              {fav.mode === 'live' ? <Radio size={12} /> : <Users size={12} />}
                              {fav.mode === 'live' ? 'Livestream' : fav.mode === 'call' ? 'Gọi 1:1' : 'Gọi nhóm'}
                            </span>
                            <button
                              className="action-btn-star is-fav"
                              onClick={(e) => onToggleFavorite(fav.id, e)}
                              title="Bỏ ghim khỏi yêu thích"
                            >
                              <Star size={16} fill="currentColor" />
                            </button>
                          </div>
                          <h3 className="fav-card-title">{fav.name}</h3>
                          <div className="fav-card-meta">
                            <span>Mã: <strong className="fav-card-code">{fav.id}</strong></span>
                            <span>· {formatTimeAgo(fav.lastVisited)}</span>
                          </div>
                        </div>

                        <div className="fav-card-actions">
                          <button
                            className="button button-primary fav-btn-join"
                            onClick={() => onSelectRoom(fav)}
                          >
                            Vào phòng ngay <ArrowRight size={14} />
                          </button>
                          <button
                            className="plain-icon mini-icon"
                            onClick={() => onCopyInvite(fav.id, fav.mode, fav.name)}
                            title="Sao chép link mời"
                          >
                            <Copy size={14} />
                          </button>
                          <button
                            className="plain-icon mini-icon"
                            onClick={(e) => onDeleteHistory(fav.id, e)}
                            title="Xóa khỏi danh sách"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ) : (
                <div className="fav-empty-state">
                  <Star size={46} className="fav-empty-star" fill="#f59e0b" />
                  <strong>Chưa có phòng yêu thích nào</strong>
                  <p>
                    Khi xem danh sách phòng trong tab "Tất cả phòng" hoặc "Gọi nhóm", hãy bấm vào biểu tượng ngôi sao ⭐ bên cạnh tên phòng để ghim phòng vào đây.
                  </p>
                  <button className="button button-primary" onClick={() => onSetActiveFilter('all')}>
                    <AudioLines size={15} /> Xem danh sách phòng
                  </button>
                </div>
              )}
            </>
          )}

          {/* ====================================================
              TAB 3: GỌI NHÓM (HỘI NGHỊ TRỰC TUYẾN P2P)
             ==================================================== */}
          {activeFilter === 'group' && (
            <>
              <section className="tab-hero-box tab-hero-group">
                <div>
                  <span className="tab-badge tab-badge-group">
                    <Users size={12} /> HỘI NGHỊ TRỰC TUYẾN P2P MESH
                  </span>
                  <h1>Phòng họp & Gọi nhóm</h1>
                  <p className="welcome-subtitle">
                    Tổ chức cuộc họp chất lượng cao không giới hạn thời gian. Kết nối ngang hàng bảo mật WebRTC Mesh giữa các thiết bị.
                  </p>
                </div>
                <div className="tab-hero-actions">
                  <button className="button button-primary" onClick={() => onOpenCreateDialog('group')}>
                    <Plus size={15} /> Tạo cuộc họp ngay
                  </button>
                </div>
              </section>

              {/* Group Quick Actions */}
              <section className="start-grid" aria-label="Bắt đầu cuộc họp nhóm">
                <button
                  className="start-card start-primary"
                  onClick={() => onOpenCreateDialog('group')}
                >
                  <span className="start-symbol">
                    <Users size={20} />
                  </span>
                  <span className="start-copy">
                    <strong>Bắt đầu cuộc họp mới</strong>
                    <small>Tạo phòng họp nhóm tức thì và lấy link gửi người tham gia</small>
                  </span>
                  <span className="round-arrow">
                    <ArrowRight size={17} />
                  </span>
                  <span className="start-watermark">
                    <Users size={90} />
                  </span>
                </button>

                <form
                  className="start-card join-card"
                  onSubmit={(e) => {
                    e.preventDefault()
                    if (joinCode.trim()) {
                      onJoinByCode(joinCode.trim())
                    }
                  }}
                >
                  <span className="start-symbol join-symbol">
                    <Link2 size={19} />
                  </span>
                  <span className="start-copy">
                    <strong>Tham gia cuộc họp</strong>
                    <small>Nhập mã cuộc họp hoặc dán liên kết mời</small>
                  </span>
                  <label className="join-input-wrap">
                    <span className="sr-only">Mã phòng họp</span>
                    <input
                      value={joinCode}
                      onChange={(e) => onSetJoinCode(e.target.value)}
                      placeholder="VD: STANDUP hoặc link..."
                    />
                    <button type="submit" disabled={!joinCode.trim()} aria-label="Tham gia cuộc họp">
                      <ArrowRight size={16} />
                    </button>
                  </label>
                </form>
              </section>

              {/* Group Features Highlights */}
              <div className="group-features-grid">
                <div className="group-feature-card">
                  <span className="group-feature-icon">
                    <MonitorUp size={18} />
                  </span>
                  <strong>Chia sẻ màn hình HD</strong>
                  <p>Trình chiếu slide, mã nguồn, tab trình duyệt với âm thanh hệ thống sắc nét.</p>
                </div>
                <div className="group-feature-card">
                  <span className="group-feature-icon">
                    <Hand size={18} />
                  </span>
                  <strong>Giơ tay & Biểu cảm</strong>
                  <p>Tương tác trực tiếp không gián đoạn, thả biểu cảm cảm xúc và phát biểu theo lượt.</p>
                </div>
                <div className="group-feature-card">
                  <span className="group-feature-icon">
                    <ShieldCheck size={18} />
                  </span>
                  <strong>Bảo mật P2P Mesh</strong>
                  <p>Dữ liệu truyền thẳng giữa các máy duyệt web, bảo mật tối đa, không lưu trên server.</p>
                </div>
              </div>

              {/* Group Rooms History */}
              <section className="section-block">
                <div className="section-heading">
                  <div>
                    <h2>Lịch sử các cuộc gọi nhóm ({filteredHistory.length})</h2>
                    <p>Các phòng họp nhóm bạn đã từng tham gia gần đây</p>
                  </div>
                  <button className="text-link" onClick={() => onOpenCreateDialog('group')}>
                    <Plus size={14} /> Cuộc họp mới
                  </button>
                </div>

                <div className="activity-list">
                  {filteredHistory.map((item) => (
                    <div
                      key={item.id}
                      className="activity-row"
                      onClick={() => onSelectRoom(item)}
                      role="button"
                      tabIndex={0}
                    >
                      <span className="activity-avatar coral">
                        <Users size={16} />
                      </span>

                      <span className="activity-info">
                        <strong>{item.name}</strong>
                        <small>Mã phòng: {item.id}</small>
                      </span>

                      <span className="activity-time">{formatTimeAgo(item.lastVisited)}</span>

                      <span className="activity-type">
                        <Users size={13} /> {item.mode === 'call' ? 'Gọi 1:1' : 'Gọi nhóm'}
                      </span>

                      <div className="activity-actions" onClick={(e) => e.stopPropagation()}>
                        <button
                          className={`action-btn-star ${item.isFavorite ? 'is-fav' : ''}`}
                          onClick={(e) => onToggleFavorite(item.id, e)}
                          title={item.isFavorite ? 'Bỏ yêu thích' : 'Thêm vào yêu thích'}
                        >
                          <Star size={15} fill={item.isFavorite ? 'currentColor' : 'none'} />
                        </button>
                        <button
                          className="action-btn-copy"
                          onClick={() => onCopyInvite(item.id, item.mode, item.name)}
                          title="Sao chép liên kết mời"
                        >
                          <Copy size={15} />
                        </button>
                        <button
                          className="action-btn-delete"
                          onClick={(e) => onDeleteHistory(item.id, e)}
                          title="Xóa khỏi lịch sử"
                        >
                          <Trash2 size={15} />
                        </button>
                        <button className="activity-join" onClick={() => onSelectRoom(item)}>
                          Vào họp <ArrowRight size={14} />
                        </button>
                      </div>
                    </div>
                  ))}

                  {filteredHistory.length === 0 && (
                    <div className="activity-empty">
                      <Users size={34} />
                      <strong>Chưa có cuộc gọi nhóm nào</strong>
                      <p>Hãy bắt đầu cuộc họp đầu tiên để kết nối cùng bạn bè và đồng nghiệp!</p>
                      <button className="button button-primary" onClick={() => onOpenCreateDialog('group')}>
                        Bắt đầu cuộc họp ngay
                      </button>
                    </div>
                  )}
                </div>
              </section>
            </>
          )}

          {/* ====================================================
              TAB 4: LIVESTREAM (SÀN PHÁT SÓNG TRỰC TIẾP)
             ==================================================== */}
          {activeFilter === 'live' && (
            <>
              <section className="tab-hero-box tab-hero-live">
                <div>
                  <span className="tab-badge tab-badge-live">
                    <span className="live-pulse-dot" /> LIVE STREAMING HUB
                  </span>
                  <h1>Khám phá & Phát sóng trực tiếp</h1>
                  <p className="welcome-subtitle">
                    Lướt xem các luồng phát sóng thời gian thực không cần mã phòng, hoặc tự mình bật camera để phát sóng cho khán giả cùng theo dõi.
                  </p>
                </div>
                <div className="tab-hero-actions">
                  <button className="button button-live" onClick={() => onOpenCreateDialog('live')}>
                    <Radio size={15} /> Bắt đầu phát sóng của bạn
                  </button>
                  <button
                    className="plain-icon mini-icon refresh-btn"
                    onClick={onRefreshLiveStreams}
                    title="Cập nhật danh sách luồng phát"
                  >
                    <RefreshCw size={14} />
                  </button>
                </div>
              </section>

              {/* Full Live Discovery Block */}
              <section className="section-block">
                <div className="section-heading">
                  <div>
                    <div className="section-live-tag">
                      <span className="live-pulse-dot" />
                      <strong>ĐANG TRỰC TIẾP</strong>
                      <span className="live-total-pill">{liveStreams.length} luồng</span>
                    </div>
                    <h2>Các luồng đang phát sóng</h2>
                    <p>Nhấn vào thẻ bất kỳ để vào xem ngay — không yêu cầu mã phòng hay link mời</p>
                  </div>
                </div>

                {liveStreams.length === 0 ? (
                  <div className="live-empty-state">
                    <Radio size={42} className="live-empty-icon" />
                    <strong>Chưa có ai đang phát sóng trực tiếp</strong>
                    <p>Hiện tại chưa có luồng phát sóng nào đang hoạt động. Hãy là người đầu tiên lên sóng!</p>
                    <button className="button button-live" onClick={() => onOpenCreateDialog('live')}>
                      <Radio size={14} /> Bắt đầu phát sóng ngay
                    </button>
                  </div>
                ) : (
                  <div className="live-discovery-grid">
                    {liveStreams.map((stream) => (
                      <div key={stream.id} className="live-stream-card">
                        <div
                          className="live-card-thumb"
                          onClick={() => onWatchLiveStream(stream)}
                          role="button"
                          tabIndex={0}
                          title="Bấm để vào xem ngay"
                        >
                          <div className="thumb-live-badge">
                            <span className="live-pulse-dot" />
                            <span>LIVE</span>
                          </div>
                          <div className="thumb-viewers-badge">
                            <Users size={12} />
                            <span>{stream.viewersCount}</span>
                          </div>

                          <div className="thumb-center-art">
                            <span className={`avatar avatar-${stream.streamerAvatar || 'violet'}`}>
                              {initials(stream.streamerName)}
                            </span>
                            <div className="thumb-play-overlay">
                              <Play size={24} fill="#fff" />
                              <span>Xem ngay</span>
                            </div>
                          </div>

                          {stream.tag && <span className="thumb-topic-tag">{stream.tag}</span>}
                        </div>

                        <div className="live-card-info">
                          <h3 className="live-card-title" onClick={() => onWatchLiveStream(stream)}>
                            {stream.title}
                          </h3>

                          <div className="live-card-streamer">
                            <span className="streamer-avatar-micro">{initials(stream.streamerName)}</span>
                            <span className="streamer-name">{stream.streamerName}</span>
                          </div>

                          {stream.description && <p className="live-card-desc">{stream.description}</p>}

                          <div className="live-card-footer">
                            <button
                              className="button button-primary live-watch-btn"
                              onClick={() => onWatchLiveStream(stream)}
                            >
                              <Play size={13} fill="#fff" /> Vào xem ngay
                            </button>
                            <button
                              className="plain-icon mini-icon"
                              onClick={(e) => {
                                e.stopPropagation()
                                onCopyInvite(stream.id, 'live', stream.title)
                              }}
                              title="Sao chép link mời"
                            >
                              <Copy size={13} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Live Streams History */}
              <section className="section-block">
                <div className="section-heading">
                  <div>
                    <h2>Phòng phát sóng bạn từng tham gia ({filteredHistory.length})</h2>
                    <p>Lịch sử các luồng livestream bạn đã từng tổ chức hoặc xem</p>
                  </div>
                </div>

                <div className="activity-list">
                  {filteredHistory.map((item) => (
                    <div
                      key={item.id}
                      className="activity-row"
                      onClick={() => onSelectRoom(item)}
                      role="button"
                      tabIndex={0}
                    >
                      <span className="activity-avatar violet">
                        <Radio size={16} />
                      </span>

                      <span className="activity-info">
                        <strong>{item.name}</strong>
                        <small>Mã phòng: {item.id}</small>
                      </span>

                      <span className="activity-time">{formatTimeAgo(item.lastVisited)}</span>

                      <span className="activity-type">
                        <Radio size={13} /> Livestream
                      </span>

                      <div className="activity-actions" onClick={(e) => e.stopPropagation()}>
                        <button
                          className={`action-btn-star ${item.isFavorite ? 'is-fav' : ''}`}
                          onClick={(e) => onToggleFavorite(item.id, e)}
                          title={item.isFavorite ? 'Bỏ yêu thích' : 'Thêm vào yêu thích'}
                        >
                          <Star size={15} fill={item.isFavorite ? 'currentColor' : 'none'} />
                        </button>
                        <button
                          className="action-btn-copy"
                          onClick={() => onCopyInvite(item.id, item.mode, item.name)}
                          title="Sao chép liên kết mời"
                        >
                          <Copy size={15} />
                        </button>
                        <button
                          className="action-btn-delete"
                          onClick={(e) => onDeleteHistory(item.id, e)}
                          title="Xóa khỏi lịch sử"
                        >
                          <Trash2 size={15} />
                        </button>
                        <button className="activity-join" onClick={() => onSelectRoom(item)}>
                          Vào xem <ArrowRight size={14} />
                        </button>
                      </div>
                    </div>
                  ))}

                  {filteredHistory.length === 0 && (
                    <div className="activity-empty">
                      <Radio size={34} />
                      <strong>Chưa có phòng livestream nào trong lịch sử</strong>
                      <p>Bạn chưa từng tham gia hoặc phát sóng luồng trực tiếp nào.</p>
                      <button className="button button-live" onClick={() => onOpenCreateDialog('live')}>
                        Bắt đầu phát sóng ngay
                      </button>
                    </div>
                  )}
                </div>
              </section>
            </>
          )}

          <div className="workspace-footnote">
            <ShieldCheck size={14} /> Cuộc gọi được kết nối trực tiếp ngang hàng (P2P Mesh WebRTC) <span>·</span>
            <button
              onClick={() =>
                onShowNotice(
                  'Dữ liệu video và âm thanh truyền trực tiếp giữa các thiết bị thông qua STUN server công cộng của Google. Bảo mật cao, không lưu trữ trên máy chủ.',
                )
              }
            >
              Tìm hiểu công nghệ
            </button>
          </div>
        </div>
      </main>

      {/* Right Rail */}
      <aside className="right-rail">
        <div className="rail-top">
          <span>Tiện ích nhanh</span>
        </div>

        {/* Favorite rooms */}
        <section className="rail-section">
          <div className="rail-section-heading">
            <h3>Phòng đã lưu ({favoriteRooms.length})</h3>
            <button className="plain-icon" title="Tạo phòng mới" onClick={() => onOpenCreateDialog()}>
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
                  onClick={() => onSelectRoom(fav)}
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
                  onClick={() => onCopyInvite(fav.id, fav.mode, fav.name)}
                  title="Sao chép liên kết"
                >
                  <Copy size={13} />
                </button>
              </div>
            ))
          )}
        </section>

        {/* Device Check Card */}
        <section className="rail-section">
          <div className="rail-section-heading">
            <h3>Kiểm tra thiết bị</h3>
            <button className="plain-icon" onClick={onOpenSettingsDialog} title="Cài đặt">
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
            <button className="button button-outline full-width" onClick={onOpenSettingsDialog}>
              Kiểm tra âm thanh & hình ảnh
            </button>
          </div>
        </section>

        {/* Invite Banner */}
        <button
          className="invite-banner"
          onClick={() => {
            const code = crypto.randomUUID().slice(0, 8).toUpperCase()
            onCopyInvite(code, 'group', `Phòng họp của ${profile.name}`)
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
              onShowNotice(
                'Ứng dụng hoạt động dựa trên WebRTC chuẩn w3c, phù hợp cho nhóm họp trực tiếp không cần đăng ký tài khoản.',
              )
            }
          >
            <CircleHelp size={15} />
          </button>
        </div>
      </aside>
    </div>
  )
}

