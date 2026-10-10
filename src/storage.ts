import type { RoomHistoryItem, UserProfile } from './types'

const STORAGE_KEY_HISTORY = 'meet_room_history_v1'
const STORAGE_KEY_PROFILE = 'meet_user_profile_v1'

const DEFAULT_PROFILE: UserProfile = {
  name: '',
  avatarColor: 'blue',
  statusText: 'Sẵn sàng kết nối',
}

export function loadUserProfile(): UserProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PROFILE)
    if (raw) {
      return { ...DEFAULT_PROFILE, ...JSON.parse(raw) }
    }
    // Fallback old key if exists
    const oldName = localStorage.getItem('meet-display-name')
    if (oldName) {
      return { ...DEFAULT_PROFILE, name: oldName }
    }
  } catch {
    // ignore json error
  }
  return DEFAULT_PROFILE
}

export function saveUserProfile(profile: UserProfile): void {
  try {
    localStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(profile))
    localStorage.setItem('meet-display-name', profile.name)
  } catch {
    // ignore
  }
}

export function loadRoomHistory(): RoomHistoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_HISTORY)
    if (raw) {
      const parsed = JSON.parse(raw) as RoomHistoryItem[]
      if (Array.isArray(parsed)) {
        return parsed.sort((a, b) => b.lastVisited - a.lastVisited)
      }
    }
  } catch {
    // ignore
  }
  return []
}

export function saveRoomHistory(history: RoomHistoryItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(history.slice(0, 50)))
  } catch {
    // ignore
  }
}

export function recordRoomVisit(item: {
  id: string
  name: string
  mode: RoomHistoryItem['mode']
  role: RoomHistoryItem['role']
}): RoomHistoryItem[] {
  const history = loadRoomHistory()
  const existingIdx = history.findIndex((h) => h.id.toUpperCase() === item.id.toUpperCase())
  const isFavorite = existingIdx >= 0 ? history[existingIdx].isFavorite : false

  const updated: RoomHistoryItem = {
    id: item.id.toUpperCase(),
    name: item.name.trim() || `Phòng ${item.id.toUpperCase()}`,
    mode: item.mode,
    role: item.role,
    lastVisited: Date.now(),
    isFavorite,
  }

  const next = [updated, ...history.filter((h) => h.id.toUpperCase() !== item.id.toUpperCase())]
  saveRoomHistory(next)
  return next
}

export function toggleFavoriteRoom(id: string): RoomHistoryItem[] {
  const history = loadRoomHistory()
  const next = history.map((h) => {
    if (h.id.toUpperCase() === id.toUpperCase()) {
      return { ...h, isFavorite: !h.isFavorite }
    }
    return h
  })
  saveRoomHistory(next)
  return next
}

export function deleteRoomHistory(id: string): RoomHistoryItem[] {
  const history = loadRoomHistory()
  const next = history.filter((h) => h.id.toUpperCase() !== id.toUpperCase())
  saveRoomHistory(next)
  return next
}

export function formatTimeAgo(timestamp: number): string {
  const diffSec = Math.floor((Date.now() - timestamp) / 1000)
  if (diffSec < 60) return 'Vừa xong'
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin} phút trước`
  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return `${diffHours} giờ trước`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 30) return `${diffDays} ngày trước`
  return new Date(timestamp).toLocaleDateString('vi-VN')
}
