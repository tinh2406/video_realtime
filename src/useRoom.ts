import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChatMessage, FloatingReaction, PeerStatus, RoomMode, RoomRole } from './types'

export type RoomParticipant = {
  id: string
  name: string
  stream: MediaStream
  screenStream?: MediaStream
}

type WireMessage = {
  type: string
  peerId?: string
  peers?: Array<{ peerId: string; name: string; mode: RoomMode }>
  name?: string
  mode?: RoomMode
  to?: string
  from?: string
  payload?: RTCSessionDescriptionInit | RTCIceCandidateInit
  message?: string
  reason?: string
  status?: Partial<PeerStatus>
}

type PeerDataMessage =
  | { type: 'chat'; message: ChatMessage }
  | { type: 'reaction'; reaction: FloatingReaction }
  | { type: 'status'; peerId: string; status: Partial<PeerStatus> }
  | { type: 'request-status'; from: string }

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    {
      urls: [
        `turn:${typeof window !== 'undefined' ? window.location.hostname : '127.0.0.1'}:3478?transport=udp`,
        `turn:${typeof window !== 'undefined' ? window.location.hostname : '127.0.0.1'}:3478?transport=tcp`,
      ],
      username: 'user',
      credential: 'password123',
    },
  ],
}

export function useRoom(
  roomId: string | null,
  mode: RoomMode,
  role: RoomRole,
  displayName: string,
  localStream: MediaStream | null,
  roomTitle?: string,
) {
  const [participants, setParticipants] = useState<RoomParticipant[]>([])
  const [connectionState, setConnectionState] = useState('Đang kết nối')
  const [roomError, setRoomError] = useState('')
  const [roomEnded, setRoomEnded] = useState(false)
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [reactions, setReactions] = useState<FloatingReaction[]>([])
  const [peerStatuses, setPeerStatuses] = useState<Record<string, PeerStatus>>({})
  const [localHandRaised, setLocalHandRaised] = useState(false)
  const [localIsSpeaking, setLocalIsSpeaking] = useState(false)

  const socketRef = useRef<WebSocket | null>(null)
  const screenStreamRef = useRef<MediaStream | null>(null)
  screenStreamRef.current = screenStream
  const peerConnections = useRef(new Map<string, RTCPeerConnection>())
  const screenSenders = useRef(new Map<string, RTCRtpSender>())
  const dataChannels = useRef(new Map<string, RTCDataChannel>())
  const remoteStreams = useRef(new Map<string, Map<string, MediaStream>>())
  const peerStatusesRef = useRef<Record<string, PeerStatus>>({})
  const pendingCandidates = useRef(new Map<string, RTCIceCandidateInit[]>())
  const localPeerId = useRef(crypto.randomUUID())
  const audioContextRef = useRef<AudioContext | null>(null)
  const audioAnalysers = useRef(new Map<string, AnalyserNode>())
  const requestNegotiationRef = useRef<((peerId: string, connection: RTCPeerConnection) => void) | null>(null)

  const getScreenMids = useCallback(() => {
    const mids: Record<string, string> = {}
    for (const [peerId, sender] of screenSenders.current) {
      const connection = peerConnections.current.get(peerId)
      const mid = connection?.getTransceivers().find((transceiver) => transceiver.sender === sender)?.mid
      if (mid) mids[peerId] = mid
    }
    return mids
  }, [])

  // Broadcast data channel message to all connected peers
  const broadcastData = useCallback((data: PeerDataMessage) => {
    const raw = JSON.stringify(data)
    dataChannels.current.forEach((channel) => {
      if (channel.readyState === 'open') {
        try {
          channel.send(raw)
        } catch {
          // ignore send error
        }
      }
    })
  }, [])

  const sendWs = useCallback((data: Record<string, unknown>) => {
    const socket = socketRef.current
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(data))
    }
  }, [])

  // Audio energy detection helper
  const setupAudioAnalyser = useCallback((id: string, stream: MediaStream) => {
    const audioTrack = stream.getAudioTracks()[0]
    if (!audioTrack) return

    try {
      if (!audioContextRef.current) {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        audioContextRef.current = new AudioCtx()
      }
      const ctx = audioContextRef.current
      if (ctx.state === 'suspended') {
        void ctx.resume()
      }

      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.5
      source.connect(analyser)
      audioAnalysers.current.set(id, analyser)
    } catch {
      // AudioContext could fail on some restricted permissions
    }
  }, [])

  const syncRemoteParticipant = useCallback((peerId: string, name: string) => {
    const streams = remoteStreams.current.get(peerId)
    if (!streams) return
    const status = peerStatusesRef.current[peerId]
    const screenMid = status?.screenMids?.[localPeerId.current] ?? status?.screenMid
    const screenStream = status?.screenSharing
      ? (screenMid ? streams.get(screenMid) : undefined)
        ?? (status.screenStreamId ? streams.get(status.screenStreamId) : undefined)
      : undefined
    const cameraTracks = [...new Set(
      [...streams.entries()]
        .filter(([key]) => key !== screenMid && key !== status?.screenStreamId)
        .flatMap(([, stream]) => stream.getTracks()),
    )]
    const cameraStream = new MediaStream(cameraTracks)
    setParticipants((current) => {
      const next = current.filter((participant) => participant.id !== peerId)
      return [...next, { id: peerId, name, stream: cameraStream, screenStream }]
    })
    setupAudioAnalyser(peerId, cameraStream)
  }, [setupAudioAnalyser])

  // Poll voice energy for speaking indicator
  useEffect(() => {
    const interval = setInterval(() => {
      // Local stream check
      const localAnalyser = audioAnalysers.current.get('local')
      if (localAnalyser) {
        const data = new Uint8Array(localAnalyser.frequencyBinCount)
        localAnalyser.getByteFrequencyData(data)
        let sum = 0
        for (let i = 0; i < data.length; i++) sum += data[i]
        const avg = sum / data.length
        const isSpeaking = avg > 14
        setLocalIsSpeaking(isSpeaking)
      }

      // Remote streams check
      audioAnalysers.current.forEach((analyser, peerId) => {
        if (peerId === 'local') return
        const data = new Uint8Array(analyser.frequencyBinCount)
        analyser.getByteFrequencyData(data)
        let sum = 0
        for (let i = 0; i < data.length; i++) sum += data[i]
        const avg = sum / data.length
        const isSpeaking = avg > 14

        setPeerStatuses((prev) => {
          const current = prev[peerId]
          if (!current || current.isSpeaking === isSpeaking) return prev
          return {
            ...prev,
            [peerId]: { ...current, isSpeaking },
          }
        })
      })
    }, 200)

    return () => clearInterval(interval)
  }, [])

  // Setup local audio analyser when localStream updates
  useEffect(() => {
    if (localStream) {
      setupAudioAnalyser('local', localStream)
    }
  }, [localStream, setupAudioAnalyser])

  // Broadcast local status updates whenever they change
  const broadcastLocalStatus = useCallback((partial: Partial<PeerStatus>) => {
    const isMuted = localStream ? !localStream.getAudioTracks().some((t) => t.enabled) : true
    const cameraOff = localStream ? !localStream.getVideoTracks().some((t) => t.enabled) : true

    const fullStatus: PeerStatus = {
      peerId: localPeerId.current,
      name: displayName,
      isMuted,
      cameraOff,
      isSpeaking: localIsSpeaking,
      handRaised: localHandRaised,
      screenSharing: Boolean(screenStream),
      screenStreamId: screenStream?.id,
      screenMids: getScreenMids(),
      ...partial,
    }

    broadcastData({
      type: 'status',
      peerId: localPeerId.current,
      status: fullStatus,
    })
    sendWs({ type: 'status', peerId: localPeerId.current, status: fullStatus })
  }, [broadcastData, displayName, getScreenMids, localHandRaised, localIsSpeaking, localStream, screenStream, sendWs])

  // Setup RTCDataChannel listener
  const attachDataChannelListeners = useCallback((channel: RTCDataChannel, peerId: string) => {
    channel.onopen = () => {
      // Send initial status to new peer
      const isMuted = localStream ? !localStream.getAudioTracks().some((t) => t.enabled) : true
      const cameraOff = localStream ? !localStream.getVideoTracks().some((t) => t.enabled) : true
      try {
        channel.send(JSON.stringify({
          type: 'status',
          peerId: localPeerId.current,
          status: {
            peerId: localPeerId.current,
            name: displayName,
            isMuted,
            cameraOff,
            isSpeaking: false,
            handRaised: localHandRaised,
            screenSharing: Boolean(screenStreamRef.current),
            screenStreamId: screenStreamRef.current?.id,
            screenMids: getScreenMids(),
          },
        }))
      } catch {
        // ignore
      }
    }

    channel.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as PeerDataMessage
        if (msg.type === 'chat') {
          setChatMessages((prev) => [...prev, msg.message])
        } else if (msg.type === 'reaction') {
          setReactions((prev) => [...prev, msg.reaction])
          setTimeout(() => {
            setReactions((current) => current.filter((r) => r.id !== msg.reaction.id))
          }, 3200)
        } else if (msg.type === 'status' && msg.peerId) {
          const nextStatus = { ...peerStatusesRef.current[msg.peerId], ...msg.status } as PeerStatus
          peerStatusesRef.current = { ...peerStatusesRef.current, [msg.peerId]: nextStatus }
          setPeerStatuses((prev) => {
            const existing = prev[msg.peerId] ?? {
              peerId: msg.peerId,
              name: 'Thành viên',
              isMuted: false,
              cameraOff: false,
              isSpeaking: false,
              handRaised: false,
              screenSharing: false,
            }
            return {
              ...prev,
              [msg.peerId]: { ...existing, ...msg.status },
            }
          })
          syncRemoteParticipant(msg.peerId, nextStatus.name || 'Thành viên')
        }
      } catch {
        // ignore non-json
      }
    }

    dataChannels.current.set(peerId, channel)
  }, [displayName, getScreenMids, localHandRaised, localStream, syncRemoteParticipant])

  // Main room connection effect
  useEffect(() => {
    if (!roomId) return
    setRoomEnded(false)
    let disposed = false
    let failed = false
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const socket = new WebSocket(`${protocol}//${window.location.host}/ws`)
    socketRef.current = socket
    const pendingNegotiations = new Set<string>()

    const negotiate = async (peerId: string, connection: RTCPeerConnection) => {
      if (connection.signalingState !== 'stable') {
        pendingNegotiations.add(peerId)
        return
      }
      pendingNegotiations.delete(peerId)
      try {
        const offer = await connection.createOffer()
        await connection.setLocalDescription(offer)
        sendWs({ type: 'signal', to: peerId, from: localPeerId.current, payload: offer })
      } catch {
        pendingNegotiations.add(peerId)
        setRoomError('Không thể thương lượng luồng video mới. Hãy thử chia sẻ lại sau giây lát.')
      }
    }
    requestNegotiationRef.current = (peerId, connection) => { void negotiate(peerId, connection) }

    const attachActiveScreenTrack = (peerId: string, connection: RTCPeerConnection) => {
      const stream = screenStreamRef.current
      const track = stream?.getVideoTracks()[0]
      if (!stream || !track || screenSenders.current.has(peerId)) return
      screenSenders.current.set(peerId, connection.addTrack(track, stream))
    }

    const connectPeer = (peerId: string, name: string) => {
      const existing = peerConnections.current.get(peerId)
      if (existing) return existing

      const connection = new RTCPeerConnection(ICE_SERVERS)
      peerConnections.current.set(peerId, connection)

      // Create negotiated data channel
      try {
        const channel = connection.createDataChannel('meet-data', { negotiated: true, id: 0 })
        attachDataChannelListeners(channel, peerId)
      } catch {
        // fallback to ondatachannel
        connection.ondatachannel = (e) => attachDataChannelListeners(e.channel, peerId)
      }

      if (localStream) {
        localStream.getTracks().forEach((track) => connection.addTrack(track, localStream))
        if (!localStream.getVideoTracks().length) connection.addTransceiver('video', { direction: 'recvonly' })
      } else {
        connection.addTransceiver('audio', { direction: 'recvonly' })
        connection.addTransceiver('video', { direction: 'recvonly' })
      }

      connection.ontrack = (event) => {
        const stream = event.streams[0] ?? new MediaStream([event.track])
        const streams = remoteStreams.current.get(peerId) ?? new Map<string, MediaStream>()
        const mid = event.transceiver.mid
        if (mid) streams.set(mid, stream)
        streams.set(stream.id, stream)
        remoteStreams.current.set(peerId, streams)
        syncRemoteParticipant(peerId, name)
      }

      connection.onicecandidate = (event) => {
        if (event.candidate) {
          sendWs({
            type: 'signal',
            to: peerId,
            from: localPeerId.current,
            payload: event.candidate.toJSON(),
          })
        }
      }

      connection.onconnectionstatechange = () => {
        if (connection.connectionState === 'failed') {
          setRoomError('Không thể thiết lập kết nối trực tiếp với một thành viên. Hãy thử tham gia lại.')
        }
        if (connection.connectionState === 'connected') setRoomError('')
      }
      connection.onsignalingstatechange = () => {
        if (connection.signalingState === 'stable' && pendingNegotiations.has(peerId)) {
          void negotiate(peerId, connection)
        }
      }

      return connection
    }

    const createOffer = async (peerId: string, name: string) => {
      const connection = connectPeer(peerId, name)
      attachActiveScreenTrack(peerId, connection)
      await negotiate(peerId, connection)
    }

    socket.onopen = () => {
      if (disposed) return
      setConnectionState('Đang trong phòng')
      socket.send(JSON.stringify({
        type: 'join',
        room: roomId,
        peerId: localPeerId.current,
        name: displayName,
        mode,
        role,
        title: roomTitle,
      }))
    }

    socket.onmessage = (event) => {
      let message: WireMessage
      try {
        message = JSON.parse(event.data) as WireMessage
      } catch {
        setRoomError('Máy chủ gửi dữ liệu không hợp lệ.')
        return
      }

      if (message.type === 'peers' && message.peers) {
        message.peers.forEach(({ peerId, name }) => {
          void createOffer(peerId, name).catch(() => {
            setRoomError('Không thể bắt đầu cuộc gọi với một thành viên.')
          })
        })
      }

      if (message.type === 'peer-joined') setConnectionState('Có thành viên mới')
      if (message.type === 'error') setRoomError(message.message ?? 'Máy chủ từ chối tham gia phòng.')
      if (message.type === 'room-ended') {
        setRoomEnded(true)
        setConnectionState('Livestream đã kết thúc')
        setRoomError('Người phát đã kết thúc livestream.')
        peerConnections.current.forEach((connection) => connection.close())
        peerConnections.current.clear()
        dataChannels.current.clear()
        remoteStreams.current.clear()
        setParticipants([])
      }

      if (message.type === 'peer-left' && message.peerId) {
        peerConnections.current.get(message.peerId)?.close()
        peerConnections.current.delete(message.peerId)
        screenSenders.current.delete(message.peerId)
        dataChannels.current.delete(message.peerId)
        remoteStreams.current.delete(message.peerId)
        audioAnalysers.current.delete(message.peerId)

        setParticipants((current) => current.filter((participant) => participant.id !== message.peerId))
        setPeerStatuses((current) => {
          const next = { ...current }
          delete next[message.peerId!]
          return next
        })
      }

      if (message.type === 'status' && message.peerId && message.status) {
        const nextStatus = { ...peerStatusesRef.current[message.peerId], ...message.status } as PeerStatus
        peerStatusesRef.current = { ...peerStatusesRef.current, [message.peerId]: nextStatus }
        setPeerStatuses((current) => ({ ...current, [message.peerId!]: { ...current[message.peerId!], ...message.status } as PeerStatus }))
        syncRemoteParticipant(message.peerId, nextStatus.name || 'Thành viên')
      }

      if (message.type === 'signal' && message.from && message.payload) {
        const peerId = message.from
        const peerName = message.name ?? 'Thành viên'
        const connection = connectPeer(peerId, peerName)

        if ('candidate' in message.payload) {
          const candidate = message.payload as RTCIceCandidateInit
          if (connection.remoteDescription) {
            void connection.addIceCandidate(candidate).catch(() => {
              setRoomError('Không thể hoàn tất kết nối mạng. Hãy thử lại.')
            })
          } else {
            const pending = pendingCandidates.current.get(peerId) ?? []
            pending.push(candidate)
            pendingCandidates.current.set(peerId, pending)
          }
        } else {
          const description = message.payload as RTCSessionDescriptionInit
          void connection.setRemoteDescription(description).then(async () => {
            const pending = pendingCandidates.current.get(peerId) ?? []
            pendingCandidates.current.delete(peerId)
            await Promise.all(pending.map((candidate) => connection.addIceCandidate(candidate)))
            if (description.type === 'offer') {
              const answer = await connection.createAnswer()
              await connection.setLocalDescription(answer)
              sendWs({
                type: 'signal',
                to: peerId,
                from: localPeerId.current,
                payload: answer,
              })
              attachActiveScreenTrack(peerId, connection)
              if (screenSenders.current.has(peerId)) void negotiate(peerId, connection)
            }
          }).catch(() => setRoomError('Không thể thương lượng kết nối WebRTC. Hãy thử tham gia lại.'))
        }
      }
    }

    socket.onerror = () => {
      failed = true
      setConnectionState('Mất kết nối')
      setRoomError('Không kết nối được máy chủ báo hiệu. Hãy chắc chắn máy chủ đang chạy ở cổng 8080.')
    }

    socket.onclose = () => {
      if (!disposed && !failed) setConnectionState('Đã rời phòng')
    }

    return () => {
      disposed = true
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'leave', room: roomId, peerId: localPeerId.current }))
      }
      socket.close()
      requestNegotiationRef.current = null
      peerConnections.current.forEach((connection) => connection.close())
      peerConnections.current.clear()
      screenSenders.current.clear()
      dataChannels.current.clear()
      remoteStreams.current.clear()
      pendingCandidates.current.clear()
      audioAnalysers.current.clear()
      socketRef.current = null
      setParticipants([])
      setChatMessages([])
      setReactions([])
      setPeerStatuses({})
      peerStatusesRef.current = {}
    }
  }, [attachDataChannelListeners, displayName, localStream, mode, role, roomId, sendWs, setupAudioAnalyser, syncRemoteParticipant])

  // Leave room action
  const leaveRoom = useCallback(() => {
    socketRef.current?.close()
    setConnectionState('Đã rời phòng')
  }, [])

  // Send chat message
  const sendChatMessage = useCallback((text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return

    const message: ChatMessage = {
      id: crypto.randomUUID(),
      senderId: localPeerId.current,
      senderName: displayName,
      text: trimmed,
      timestamp: Date.now(),
      isSelf: true,
    }

    setChatMessages((prev) => [...prev, message])
    broadcastData({ type: 'chat', message })
  }, [broadcastData, displayName])

  // Send emoji reaction
  const sendReaction = useCallback((emoji: string) => {
    const reaction: FloatingReaction = {
      id: crypto.randomUUID(),
      emoji,
      senderName: displayName,
      x: 15 + Math.random() * 70, // random percentage for animation position
    }

    setReactions((prev) => [...prev, reaction])
    broadcastData({ type: 'reaction', reaction })

    setTimeout(() => {
      setReactions((current) => current.filter((r) => r.id !== reaction.id))
    }, 3200)
  }, [broadcastData, displayName])

  // Toggle Hand Raise
  const toggleHandRaise = useCallback(() => {
    setLocalHandRaised((prev) => {
      const next = !prev
      broadcastLocalStatus({ handRaised: next })
      return next
    })
  }, [broadcastLocalStatus])

  // Screen share handler
  const shareScreen = useCallback(async () => {
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
    const [screenTrack] = stream.getVideoTracks()
    if (!screenTrack) {
      stream.getTracks().forEach((track) => track.stop())
      throw new Error('Không có luồng hình ảnh để chia sẻ.')
    }

    screenStreamRef.current = stream
    for (const [peerId, connection] of peerConnections.current.entries()) {
      if (connection.signalingState !== 'stable') {
        await new Promise<void>((resolve) => {
          const onStateChange = () => {
            if (connection.signalingState === 'stable' || connection.signalingState === 'closed') {
              connection.removeEventListener('signalingstatechange', onStateChange)
              resolve()
            }
          }
          connection.addEventListener('signalingstatechange', onStateChange)
          onStateChange()
        })
      }
      if (connection.signalingState === 'closed') continue
      let screenSender = screenSenders.current.get(peerId)
      if (screenSender) {
        const transceiver = connection.getTransceivers().find((item) => item.sender === screenSender)
        if (transceiver) transceiver.direction = 'sendonly'
        await screenSender.replaceTrack(screenTrack)
        screenSender.setStreams(stream)
      } else {
        screenSender = connection.addTrack(screenTrack, stream)
        screenSenders.current.set(peerId, screenSender)
      }
      const offer = await connection.createOffer()
      await connection.setLocalDescription(offer)
      sendWs({ type: 'signal', to: peerId, from: localPeerId.current, payload: offer })
    }
    setScreenStream(stream)
    broadcastLocalStatus({ screenSharing: true, screenStreamId: stream.id, screenMids: getScreenMids() })

    screenTrack.onended = () => {
      for (const [peerId, sender] of screenSenders.current.entries()) {
        const connection = peerConnections.current.get(peerId)
        if (!connection) continue
        void sender.replaceTrack(null)
        sender.setStreams()
        const transceiver = connection.getTransceivers().find((item) => item.sender === sender)
        if (transceiver?.mid) {
          transceiver.direction = 'recvonly'
          requestNegotiationRef.current?.(peerId, connection)
        }
      }
      setScreenStream(null)
      screenStreamRef.current = null
      broadcastLocalStatus({ screenSharing: false, screenStreamId: null })
    }
    return stream
  }, [broadcastLocalStatus, getScreenMids, sendWs])

  // Stop screen sharing manually
  const stopScreenShare = useCallback(() => {
    if (screenStream) {
      screenStream.getVideoTracks().forEach((track) => { track.onended = null })
      screenStream.getTracks().forEach((t) => t.stop())
      for (const [peerId, sender] of screenSenders.current.entries()) {
        const connection = peerConnections.current.get(peerId)
        if (!connection) continue
        void sender.replaceTrack(null)
        sender.setStreams()
        const transceiver = connection.getTransceivers().find((item) => item.sender === sender)
        if (transceiver?.mid) {
          transceiver.direction = 'recvonly'
          requestNegotiationRef.current?.(peerId, connection)
        }
      }
      setScreenStream(null)
      screenStreamRef.current = null
      broadcastLocalStatus({ screenSharing: false, screenStreamId: null })
    }
  }, [broadcastLocalStatus, screenStream, sendWs])

  // Switch or replace track (e.g. switching camera or microphone device)
  const replaceTrack = useCallback(async (kind: 'audio' | 'video', newTrack: MediaStreamTrack) => {
    for (const connection of peerConnections.current.values()) {
      const sender = connection.getSenders().find((s) => s.track?.kind === kind)
      if (sender) {
        await sender.replaceTrack(newTrack)
      }
    }
  }, [])

  useEffect(() => () => {
    screenStream?.getTracks().forEach((track) => track.stop())
  }, [screenStream])

  return {
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
  }
}
