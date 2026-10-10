import { useEffect, useState } from 'react'
import { ArrowRight, Check, Radio, Users, Video, X } from 'lucide-react'
import type { RoomMode } from '../../types'

interface CreateRoomModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (mode: RoomMode, code?: string, name?: string) => void
  profileName: string
  busy?: boolean
  defaultMode?: RoomMode
}

export function CreateRoomModal({
  isOpen,
  onClose,
  onSubmit,
  profileName,
  busy = false,
  defaultMode = 'group',
}: CreateRoomModalProps) {
  const [roomName, setRoomName] = useState('')
  const [roomCode, setRoomCode] = useState('')
  const [selectedMode, setSelectedMode] = useState<RoomMode>(defaultMode)

  useEffect(() => {
    if (isOpen) {
      setSelectedMode(defaultMode)
      setRoomName('')
      setRoomCode('')
    }
  }, [isOpen, defaultMode])

  if (!isOpen) return null

  return (
    <div
      className="dialog-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <section className="create-dialog" role="dialog" aria-modal="true" aria-labelledby="create-title">
        <header>
          <span className="dialog-icon">
            <Video size={19} />
          </span>
          <button className="plain-icon" onClick={onClose} aria-label="Đóng">
            <X size={18} />
          </button>
        </header>
        <h2 id="create-title">Bắt đầu phòng mới</h2>
        <p>Chọn hình thức và thông tin phòng bạn muốn tổ chức.</p>

        <div className="form-group">
          <label>Tên hoặc chủ đề cuộc họp</label>
          <input
            className="modal-input"
            placeholder={`Ví dụ: Họp nhóm ${profileName}, Trao đổi dự án...`}
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>Mã phòng tùy chọn (để trống để tạo ngẫu nhiên)</label>
          <input
            className="modal-input"
            placeholder="VD: SPRINT-01"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
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
          <button className="button button-outline" onClick={onClose}>
            Hủy bỏ
          </button>
          <button
            className="button button-primary"
            onClick={() => onSubmit(selectedMode, roomCode.trim() || undefined, roomName.trim() || undefined)}
            disabled={busy}
          >
            {busy ? 'Đang chuẩn bị...' : 'Vào phòng chờ'} {!busy && <ArrowRight size={15} />}
          </button>
        </footer>
      </section>
    </div>
  )
}
