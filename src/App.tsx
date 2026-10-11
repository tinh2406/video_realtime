import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check } from 'lucide-react'
import { CallView } from './components/CallView'
import { DashboardView } from './components/DashboardView'
import { LiveStreamView } from './components/LiveStreamView'
import { LobbyView } from './components/LobbyView'
import { CreateRoomModal } from './components/modals/CreateRoomModal'
import { DeviceModal } from './components/modals/DeviceModal'
import { ProfileModal } from './components/modals/ProfileModal'
import {
  deleteRoomHistory,
  loadRoomHistory,
  loadUserProfile,
  recordRoomVisit,
  saveUserProfile,
  toggleFavoriteRoom,
} from './storage'
import type { ActiveRoomInfo, AppView, LiveStreamItem, RoomHistoryItem, RoomMode, RoomRole, UserProfile } from './types'
import { useRoom } from './useRoom'

export function App() {
  const [profile, setProfile] = useState<UserProfile>(loadUserProfile)
  const [roomHistory, setRoomHistory] = useState<RoomHistoryItem[]>(loadRoomHistory)
  const [activeFilter, setActiveFilter] = useState<'all' | 'favorites' | RoomMode>('all')

  // Router / Navigation state
  const [currentView, setCurrentView] = useState<AppView>('dashboard')
  const [activeRoom, setActiveRoom] = useState<ActiveRoomInfo | null>(null)

  // Media streams & device state
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [isMuted, setIsMuted] = useState(false)
  const [cameraOn, setCameraOn] = useState(true)

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [createModalMode, setCreateModalMode] = useState<RoomMode>('group')
  const [profileModalOpen, setProfileModalOpen] = useState(false)
  const [deviceModalOpen, setDeviceModalOpen] = useState(false)

  const handleOpenCreateDialog = (initialMode: RoomMode = 'group') => {
    setCreateModalMode(initialMode)
    setCreateModalOpen(true)
  }

  // Device enumeration
  const [devices, setDevices] = useState<{ audioInputs: MediaDeviceInfo[]; videoInputs: MediaDeviceInfo[] }>({
    audioInputs: [],
    videoInputs: [],
  })
  const [selectedAudioId, setSelectedAudioId] = useState<string>('')
  const [selectedVideoId, setSelectedVideoId] = useState<string>('')
  const [micVolumeLevel, setMicVolumeLevel] = useState<number>(0)

  // Search, inputs & notifications
  const [searchQuery, setSearchQuery] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const [liveStreams, setLiveStreams] = useState<LiveStreamItem[]>([])

  // Fetch active streams from server
  const fetchLiveStreams = useCallback(async () => {
    try {
      const res = await fetch('/api/live-streams')
      if (res.ok) {
        const data = (await res.json()) as LiveStreamItem[]
        setLiveStreams(data)
      }
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    void fetchLiveStreams()
    const interval = setInterval(() => {
      void fetchLiveStreams()
    }, 4000)
    return () => clearInterval(interval)
  }, [fetchLiveStreams])

  const isInitialUrlHandled = useRef(false)

  // Refresh hardware devices
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

  // Save profile updates
  const handleUpdateProfile = (updated: Partial<UserProfile>) => {
    const next = { ...profile, ...updated }
    setProfile(next)
    saveUserProfile(next)
  }

  // Connect WebRTC room hook only when inside call
  const roomConnectId = currentView === 'call' ? activeRoom?.id ?? null : null
  const roomConnectMode = activeRoom?.mode ?? 'group'

  const {
    participants,
    connectionState,
    roomError,
    roomEnded,
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
  } = useRoom(roomConnectId, roomConnectMode, activeRoom?.role ?? 'viewer', profile.name, localStream, activeRoom?.name)

  // Mic test volume meter during active call
  useEffect(() => {
    if (currentView !== 'call' || !localStream) {
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
  }, [currentView, localStream])

  // Prepare a room and navigate to Lobby (Pre-join screen)
  const prepareRoom = useCallback(
    (mode: RoomMode, code?: string, role: RoomRole = 'host', customName?: string) => {
      const roomId = code?.trim().toUpperCase() || crypto.randomUUID().slice(0, 8).toUpperCase()
      if (!/^[A-Za-z0-9_-]{1,64}$/.test(roomId)) {
        setError('Mã phòng chỉ được có chữ cái, số, dấu gạch ngang hoặc gạch dưới.')
        return
      }

      const roomTitle =
        customName?.trim() ||
        (mode === 'live'
          ? `Livestream của ${profile.name}`
          : mode === 'call'
          ? `Cuộc gọi 1:1 (${roomId})`
          : `Họp nhóm ${roomId}`)

      const info: ActiveRoomInfo = {
        id: roomId,
        name: roomTitle,
        mode,
        role,
      }

      setActiveRoom(info)
      setCurrentView('lobby')
      setCreateModalOpen(false)

      // Update URL with history push so browser back button works
      const params = new URLSearchParams()
      params.set('room', roomId)
      params.set('mode', mode)
      params.set('name', roomTitle)
      if (role === 'viewer') params.set('role', 'viewer')
      window.history.pushState({ view: 'lobby', roomId }, '', `?${params.toString()}`)
    },
    [profile.name],
  )

  // Start actual call from Lobby
  const handleStartCall = async (initialMuted: boolean, initialCameraOff: boolean) => {
    if (!activeRoom || busy) return
    setBusy(true)

    let stream: MediaStream | null = null
    const needsPublishMedia = activeRoom.mode !== 'live' || activeRoom.role === 'host'
    if (needsPublishMedia) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: selectedAudioId ? { deviceId: { exact: selectedAudioId } } : true,
          video: selectedVideoId ? { deviceId: { exact: selectedVideoId } } : true,
        })

        if (initialMuted) {
          stream.getAudioTracks().forEach((t) => {
            t.enabled = false
          })
        }
        if (initialCameraOff) {
          stream.getVideoTracks().forEach((t) => {
            t.enabled = false
          })
        }

        setIsMuted(initialMuted)
        setCameraOn(!initialCameraOff)
      } catch {
        setNotice('Không truy cập được camera hoặc micro. Bạn vẫn có thể vào phòng để nghe và xem người khác.')
      }
    } else {
      setIsMuted(true)
      setCameraOn(false)
    }

    setLocalStream(stream)
    setCurrentView('call')

    // Record visit in persistent storage
    const updated = recordRoomVisit({
      id: activeRoom.id,
      name: activeRoom.name,
      mode: activeRoom.mode,
      role: activeRoom.role,
    })
    setRoomHistory(updated)

    setBusy(false)
  }

  // Leave call and return to Dashboard
  const handleLeaveCall = () => {
    leaveRoom()
    localStream?.getTracks().forEach((t) => t.stop())
    screenStream?.getTracks().forEach((t) => t.stop())
    setLocalStream(null)
    setActiveRoom(null)
    setCurrentView('dashboard')
    window.history.pushState({ view: 'dashboard' }, '', window.location.pathname)
  }

  useEffect(() => {
    if (!roomEnded || currentView !== 'call' || activeRoom?.role !== 'viewer') return
    leaveRoom()
    localStream?.getTracks().forEach((track) => track.stop())
    screenStream?.getTracks().forEach((track) => track.stop())
    setLocalStream(null)
    setActiveRoom(null)
    setCurrentView('dashboard')
    setNotice('Livestream đã kết thúc.')
    window.history.pushState({ view: 'dashboard' }, '', window.location.pathname)
  }, [roomEnded, currentView, activeRoom?.role, leaveRoom, localStream, screenStream])

  // Return to Dashboard from Lobby
  const handleBackToDashboard = () => {
    setActiveRoom(null)
    setCurrentView('dashboard')
    window.history.pushState({ view: 'dashboard' }, '', window.location.pathname)
  }

  // 1-Click watch a live stream directly from browse/discover feed
  const handleWatchLiveStream = (stream: LiveStreamItem) => {
    const roomInfo: ActiveRoomInfo = {
      id: stream.id,
      name: stream.title,
      mode: 'live',
      role: 'viewer',
    }
    setActiveRoom(roomInfo)
    setIsMuted(true)
    setCameraOn(false)
    setLocalStream(null)
    setCurrentView('call')

    const updated = recordRoomVisit({
      id: stream.id,
      name: stream.title,
      mode: 'live',
      role: 'viewer',
    })
    setRoomHistory(updated)

    const params = new URLSearchParams()
    params.set('room', stream.id)
    params.set('mode', 'live')
    params.set('name', stream.title)
    params.set('role', 'viewer')
    window.history.pushState({ view: 'call', roomId: stream.id }, '', `?${params.toString()}`)
  }

  // Browser Back/Forward navigation (popstate)
  useEffect(() => {
    const handlePopState = () => {
      const urlParams = new URLSearchParams(window.location.search)
      const roomParam = urlParams.get('room')

      if (!roomParam) {
        // Going back to dashboard
        if (currentView === 'call') {
          leaveRoom()
          localStream?.getTracks().forEach((t) => t.stop())
          screenStream?.getTracks().forEach((t) => t.stop())
          setLocalStream(null)
        }
        setActiveRoom(null)
        setCurrentView('dashboard')
      } else if (currentView === 'call') {
        // Back from call to lobby
        leaveRoom()
        localStream?.getTracks().forEach((t) => t.stop())
        screenStream?.getTracks().forEach((t) => t.stop())
        setLocalStream(null)
        setCurrentView('lobby')
      }
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [currentView, leaveRoom, localStream, screenStream])

  // Initial load check for ?room= in URL
  useEffect(() => {
    if (isInitialUrlHandled.current) return
    isInitialUrlHandled.current = true

    const params = new URLSearchParams(window.location.search)
    const roomParam = params.get('room')
    if (roomParam) {
      const modeParam = (params.get('mode') as RoomMode) || 'group'
      const roleParam = (params.get('role') as RoomRole) || 'host'
      const nameParam = params.get('name') || `Phòng ${roomParam.toUpperCase()}`

      setActiveRoom({
        id: roomParam.toUpperCase(),
        name: nameParam,
        mode: modeParam,
        role: roleParam,
      })
      // Open in lobby so user can check camera/mic first!
      setCurrentView('lobby')
    }
  }, [])

  // Switch camera device mid-call
  const handleSwitchVideoDevice = async (deviceId: string) => {
    setSelectedVideoId(deviceId)
    if (!localStream) return
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId } },
      })
      const newTrack = newStream.getVideoTracks()[0]
      if (newTrack) {
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

  // Switch audio input device mid-call
  const handleSwitchAudioDevice = async (deviceId: string) => {
    setSelectedAudioId(deviceId)
    if (!localStream) return
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: deviceId } },
      })
      const newTrack = newStream.getAudioTracks()[0]
      if (newTrack) {
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

  // Toggle Microphone
  const handleToggleMic = async () => {
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
  const handleToggleCamera = async () => {
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

  // Copy invitation link
  const handleCopyInvite = async (id?: string, roomMode?: RoomMode, title?: string) => {
    const targetId = id || activeRoom?.id
    if (!targetId) return
    const mode = roomMode || activeRoom?.mode || 'group'
    const roleParam = mode === 'live' ? '&role=viewer' : ''
    const titleParam = title ? `&name=${encodeURIComponent(title)}` : ''
    const invite = `${window.location.origin}/?room=${encodeURIComponent(targetId)}&mode=${mode}${titleParam}${roleParam}`

    try {
      await navigator.clipboard.writeText(invite)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2200)
    } catch {
      setError('Không thể tự động sao chép. Hãy sao chép liên kết từ thanh địa chỉ.')
    }
  }

  // Favorites & room history management
  const handleToggleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const next = toggleFavoriteRoom(id)
    setRoomHistory(next)
  }

  const handleDeleteHistory = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const next = deleteRoomHistory(id)
    setRoomHistory(next)
  }

  // Join room by code or pasted URL
  const handleJoinByCode = (input: string) => {
    let code = input.trim()
    if (code.includes('room=')) {
      const match = code.match(/room=([A-Za-z0-9_-]+)/)
      if (match) code = match[1]
    }
    prepareRoom('group', code.toUpperCase())
  }

  // Filtered rooms list
  const filteredHistory = useMemo(() => {
    return roomHistory.filter((item) => {
      const matches = `${item.name} ${item.id}`.toLowerCase().includes(searchQuery.trim().toLowerCase())
      if (!matches) return false
      if (activeFilter === 'favorites') return item.isFavorite
      if (activeFilter === 'all') return true
      return item.mode === activeFilter
    })
  }, [activeFilter, roomHistory, searchQuery])

  const favoriteRooms = useMemo(() => {
    return roomHistory.filter((r) => r.isFavorite)
  }, [roomHistory])

  return (
    <>
      {/* View 1: Active Call / Stream */}
      {currentView === 'call' && activeRoom && (
        activeRoom.mode === 'live' ? (
          <LiveStreamView
            room={activeRoom}
            profile={profile}
            localStream={localStream}
            cameraOn={cameraOn}
            isMuted={isMuted}
            connectionState={connectionState}
            roomError={roomError}
            participants={participants}
            peerStatuses={peerStatuses}
            screenStream={screenStream}
            chatMessages={chatMessages}
            reactions={reactions}
            onToggleMic={handleToggleMic}
            onToggleCamera={handleToggleCamera}
            onShareScreen={shareScreen}
            onStopScreenShare={stopScreenShare}
            onSendReaction={sendReaction}
            onSendChatMessage={sendChatMessage}
            onLeave={handleLeaveCall}
            onCopyInvite={handleCopyInvite}
          />
        ) : (
          <CallView
            room={activeRoom}
            profile={profile}
            localStream={localStream}
            cameraOn={cameraOn}
            isMuted={isMuted}
            localIsSpeaking={localIsSpeaking}
            localHandRaised={localHandRaised}
            connectionState={connectionState}
            roomError={roomError}
            participants={participants}
            peerStatuses={peerStatuses}
            screenStream={screenStream}
            chatMessages={chatMessages}
            reactions={reactions}
            devices={devices}
            selectedAudioId={selectedAudioId}
            selectedVideoId={selectedVideoId}
            micVolumeLevel={micVolumeLevel}
            onToggleMic={handleToggleMic}
            onToggleCamera={handleToggleCamera}
            onShareScreen={shareScreen}
            onStopScreenShare={stopScreenShare}
            onToggleHandRaise={toggleHandRaise}
            onSendReaction={sendReaction}
            onSendChatMessage={sendChatMessage}
            onLeave={handleLeaveCall}
            onCopyInvite={handleCopyInvite}
            onSwitchAudioDevice={handleSwitchAudioDevice}
            onSwitchVideoDevice={handleSwitchVideoDevice}
          />
        )
      )}

      {/* View 2: Lobby / Pre-join Screen */}
      {currentView === 'lobby' && activeRoom && (
        <LobbyView
          room={activeRoom}
          profile={profile}
          onUpdateProfileName={(name) => handleUpdateProfile({ name })}
          onJoin={handleStartCall}
          onBackToDashboard={handleBackToDashboard}
          devices={devices}
          selectedAudioId={selectedAudioId}
          selectedVideoId={selectedVideoId}
          onSelectAudio={setSelectedAudioId}
          onSelectVideo={setSelectedVideoId}
          onOpenDeviceModal={() => setDeviceModalOpen(true)}
          onCopyInvite={handleCopyInvite}
        />
      )}

      {/* View 3: Dashboard */}
      {currentView === 'dashboard' && (
        <DashboardView
          profile={profile}
          roomHistory={roomHistory}
          favoriteRooms={favoriteRooms}
          filteredHistory={filteredHistory}
          activeFilter={activeFilter}
          searchQuery={searchQuery}
          joinCode={joinCode}
          devices={devices}
          error={error}
          notice={notice}
          onSetActiveFilter={setActiveFilter}
          onSetSearchQuery={setSearchQuery}
          onSetJoinCode={setJoinCode}
          onOpenCreateDialog={handleOpenCreateDialog}
          onOpenProfileDialog={() => setProfileModalOpen(true)}
          onOpenSettingsDialog={() => setDeviceModalOpen(true)}
          onDismissAlert={() => {
            setError('')
            setNotice('')
          }}
          onJoinByCode={handleJoinByCode}
          onSelectRoom={(item) => prepareRoom(item.mode, item.id, item.role, item.name)}
          onToggleFavorite={handleToggleFavorite}
          onDeleteHistory={handleDeleteHistory}
          onCopyInvite={handleCopyInvite}
          onShowNotice={setNotice}
          liveStreams={liveStreams}
          onWatchLiveStream={handleWatchLiveStream}
          onRefreshLiveStreams={fetchLiveStreams}
        />
      )}

      {/* Modals */}
      <CreateRoomModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSubmit={(mode, code, name) => prepareRoom(mode, code, 'host', name)}
        profileName={profile.name}
        busy={busy}
        defaultMode={createModalMode}
      />

      <ProfileModal
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        profile={profile}
        onSave={handleUpdateProfile}
      />

      <DeviceModal
        isOpen={deviceModalOpen}
        onClose={() => setDeviceModalOpen(false)}
        devices={devices}
        selectedAudioId={selectedAudioId}
        selectedVideoId={selectedVideoId}
        onSelectAudio={setSelectedAudioId}
        onSelectVideo={setSelectedVideoId}
      />

      {copied && (
        <div className="toast">
          <Check size={16} /> Đã sao chép liên kết mời
        </div>
      )}
    </>
  )
}

export default App
