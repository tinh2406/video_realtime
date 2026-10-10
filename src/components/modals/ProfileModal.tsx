import { useState } from 'react'
import { Check, Settings2, X } from 'lucide-react'
import type { UserProfile } from '../../types'

export const AVATAR_COLORS = [
  { id: 'blue', label: 'Xanh dương', class: 'avatar-blue' },
  { id: 'mint', label: 'Xanh bạc hà', class: 'avatar-mint' },
  { id: 'lilac', label: 'Tím nhạt', class: 'avatar-lilac' },
  { id: 'peach', label: 'Cam đào', class: 'avatar-peach' },
  { id: 'sky', label: 'Xanh da trời', class: 'avatar-sky' },
  { id: 'photo', label: 'Nâu đất', class: 'avatar-photo' },
]

interface ProfileModalProps {
  isOpen: boolean
  onClose: () => void
  profile: UserProfile
  onSave: (updated: Partial<UserProfile>) => void
}

export function ProfileModal({ isOpen, onClose, profile, onSave }: ProfileModalProps) {
  const [name, setName] = useState(profile.name)
  const [statusText, setStatusText] = useState(profile.statusText)
  const [avatarColor, setAvatarColor] = useState(profile.avatarColor)

  if (!isOpen) return null

  const handleSave = () => {
    onSave({ name: name.trim() || profile.name, statusText, avatarColor })
    onClose()
  }

  return (
    <div
      className="dialog-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <section className="create-dialog" role="dialog" aria-modal="true">
        <header>
          <span className="dialog-icon">
            <Settings2 size={19} />
          </span>
          <button className="plain-icon" onClick={onClose} aria-label="Đóng">
            <X size={18} />
          </button>
        </header>
        <h2>Cài đặt hồ sơ cá nhân</h2>
        <p>Thông tin này sẽ hiển thị khi bạn tham gia vào các phòng video.</p>

        <div className="form-group">
          <label>Tên hiển thị của bạn</label>
          <input
            className="modal-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nhập tên..."
          />
        </div>

        <div className="form-group">
          <label>Trạng thái hiển thị</label>
          <input
            className="modal-input"
            value={statusText}
            onChange={(e) => setStatusText(e.target.value)}
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
                  avatarColor === c.id ? 'is-selected' : ''
                }`}
                onClick={() => setAvatarColor(c.id)}
              >
                {avatarColor === c.id && <Check size={14} />}
              </button>
            ))}
          </div>
        </div>

        <footer>
          <button className="button button-primary" onClick={handleSave}>
            Hoàn tất
          </button>
        </footer>
      </section>
    </div>
  )
}
