import { useCallback, useEffect, useRef, useState } from 'react'

export type RoomMode = 'call' | 'group' | 'live'
export type RoomParticipant = {
  id: string
  name: string
  stream: MediaStream
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
}

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
}

export function useRoom(
  roomId: string | null,
  mode: RoomMode,
  displayName: string,
  localStream: MediaStream | null,
) {
  const [participants, setParticipants] = useState<RoomParticipant[]>([])
  const [connectionState, setConnectionState] = useState('Đang kết nối')
  const [roomError, setRoomError] = useState('')
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null)
  const socketRef = useRef<WebSocket | null>(null)
  const peerConnections = useRef(new Map<string, RTCPeerConnection>())
  const remoteStreams = useRef(new Map<string, MediaStream>())
  const pendingCandidates = useRef(new Map<string, RTCIceCandidateInit[]>())
  const localPeerId = useRef(crypto.randomUUID())

  const send = useCallback((data: Record<string, unknown>) => {
    const socket = socketRef.current
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(data))
    }
  }, [])

  useEffect(() => {
    if (!roomId) return
    let disposed = false
    let failed = false
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const socket = new WebSocket(`${protocol}//${window.location.host}/ws`)
    socketRef.current = socket

    const addParticipant = (id: string, name: string, stream: MediaStream) => {
      setParticipants((current) => {
        const next = current.filter((participant) => participant.id !== id)
        return [...next, { id, name, stream }]
      })
    }

    const connectPeer = (peerId: string, name: string) => {
      const existing = peerConnections.current.get(peerId)
      if (existing) return existing

      const connection = new RTCPeerConnection(ICE_SERVERS)
      peerConnections.current.set(peerId, connection)
      if (localStream) {
        localStream.getTracks().forEach((track) => connection.addTrack(track, localStream))
      } else {
        connection.addTransceiver('audio', { direction: 'recvonly' })
        connection.addTransceiver('video', { direction: 'recvonly' })
      }
      connection.ontrack = (event) => {
        const stream = event.streams[0] ?? remoteStreams.current.get(peerId) ?? new MediaStream()
        if (!event.streams[0] && !stream.getTracks().some((track) => track.id === event.track.id)) {
          stream.addTrack(event.track)
        }
        remoteStreams.current.set(peerId, stream)
        addParticipant(peerId, name, stream)
      }
      connection.onicecandidate = (event) => {
        if (event.candidate) {
          send({
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
      return connection
    }

    const createOffer = async (peerId: string, name: string) => {
      const connection = connectPeer(peerId, name)
      const offer = await connection.createOffer()
      await connection.setLocalDescription(offer)
      send({
        type: 'signal',
        to: peerId,
        from: localPeerId.current,
        payload: offer,
      })
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
      if (message.type === 'peer-left' && message.peerId) {
        peerConnections.current.get(message.peerId)?.close()
        peerConnections.current.delete(message.peerId)
        remoteStreams.current.delete(message.peerId)
        setParticipants((current) => current.filter((participant) => participant.id !== message.peerId))
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
              send({
                type: 'signal',
                to: peerId,
                from: localPeerId.current,
                payload: answer,
              })
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
      peerConnections.current.forEach((connection) => connection.close())
      peerConnections.current.clear()
      remoteStreams.current.clear()
      pendingCandidates.current.clear()
      socketRef.current = null
      setParticipants([])
    }
  }, [displayName, localStream, mode, roomId, send])

  const leaveRoom = useCallback(() => {
    socketRef.current?.close()
    setConnectionState('Đã rời phòng')
  }, [])

  const shareScreen = useCallback(async () => {
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
    const [screenTrack] = stream.getVideoTracks()
    if (!screenTrack) {
      stream.getTracks().forEach((track) => track.stop())
      throw new Error('Không có luồng hình ảnh để chia sẻ.')
    }
    for (const connection of peerConnections.current.values()) {
      const videoSender = connection.getSenders().find((sender) => sender.track?.kind === 'video')
      if (videoSender) {
        await videoSender.replaceTrack(screenTrack)
      } else {
        connection.addTrack(screenTrack, stream)
      }
    }
    setScreenStream(stream)
    screenTrack.onended = () => {
      const cameraTrack = localStream?.getVideoTracks()[0] ?? null
      for (const connection of peerConnections.current.values()) {
        const videoSender = connection.getSenders().find((sender) => sender.track?.kind === 'video')
        if (videoSender) void videoSender.replaceTrack(cameraTrack)
      }
      setScreenStream(null)
    }
    return stream
  }, [localStream])

  useEffect(() => () => {
    screenStream?.getTracks().forEach((track) => track.stop())
  }, [screenStream])

  return { participants, connectionState, roomError, leaveRoom, screenStream, shareScreen }
}
