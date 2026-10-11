export type RoomMode = 'call' | 'group' | 'live'

export type RoomRole = 'host' | 'viewer'

export type AppView = 'dashboard' | 'lobby' | 'call'

export interface ActiveRoomInfo {
  id: string
  name: string
  mode: RoomMode
  role: RoomRole
}

export interface LiveStreamItem {
  id: string
  title: string
  streamerName: string
  streamerAvatar?: string
  viewersCount: number
  tag?: string
  isLive: boolean
  description?: string
}



export interface RoomHistoryItem {
  id: string
  name: string
  mode: RoomMode
  role: RoomRole
  lastVisited: number
  isFavorite?: boolean
}

export interface UserProfile {
  name: string
  avatarColor: string
  statusText: string
}

export interface ChatMessage {
  id: string
  senderId: string
  senderName: string
  text: string
  timestamp: number
  isSelf?: boolean
}

export interface FloatingReaction {
  id: string
  emoji: string
  senderName: string
  x: number
}

export interface PeerStatus {
  peerId: string
  name: string
  isMuted: boolean
  cameraOff: boolean
  isSpeaking: boolean
  handRaised: boolean
  screenSharing: boolean
  screenStreamId?: string | null
  screenMid?: string | null
  screenMids?: Record<string, string>
}
