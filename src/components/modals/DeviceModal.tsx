import { useEffect, useRef, useState } from 'react'
import { Check, Play, Square, Volume2, X } from 'lucide-react'

interface DeviceModalProps {
  isOpen: boolean
  onClose: () => void
  devices: { audioInputs: MediaDeviceInfo[]; videoInputs: MediaDeviceInfo[] }
  selectedAudioId: string
  selectedVideoId: string
  onSelectAudio: (id: string) => void
  onSelectVideo: (id: string) => void
}

export function DeviceModal({
  isOpen,
  onClose,
  devices,
  selectedAudioId,
  selectedVideoId,
  onSelectAudio,
  onSelectVideo,
}: DeviceModalProps) {
  const [micLevel, setMicLevel] = useState(0)
  const [testState, setTestState] = useState<'idle' | 'recording' | 'playing'>('idle')
  const [countdown, setCountdown] = useState(3)
  const recordedChunks = useRef<Blob[]>([])
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const testStreamRef = useRef<MediaStream | null>(null)
  const audioElementRef = useRef<HTMLAudioElement | null>(null)

  // Live mic meter
  useEffect(() => {
    if (!isOpen) return
    let active = true

    navigator.mediaDevices
      .getUserMedia({
        audio: selectedAudioId ? { deviceId: { exact: selectedAudioId } } : true,
      })
      .then((stream) => {
        if (!active) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        testStreamRef.current = stream

        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        const ctx = new AudioCtx()
        audioContextRef.current = ctx
        const source = ctx.createMediaStreamSource(stream)
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 128
        source.connect(analyser)

        const buffer = new Uint8Array(analyser.frequencyBinCount)
        const interval = setInterval(() => {
          if (!active) return
          analyser.getByteFrequencyData(buffer)
          let total = 0
          for (let i = 0; i < buffer.length; i++) total += buffer[i]
          const avg = total / buffer.length
          setMicLevel(Math.min(100, Math.round(avg * 1.8)))
        }, 80)

        return () => {
          clearInterval(interval)
          stream.getTracks().forEach((t) => t.stop())
          void ctx.close()
        }
      })
      .catch(() => {
        // no permission
      })

    return () => {
      active = false
      testStreamRef.current?.getTracks().forEach((t) => t.stop())
      if (audioContextRef.current?.state !== 'closed') {
        void audioContextRef.current?.close()
      }
    }
  }, [isOpen, selectedAudioId])

  // Echo test: record 3 seconds and playback
  const startEchoTest = async () => {
    try {
      const stream =
        testStreamRef.current ??
        (await navigator.mediaDevices.getUserMedia({
          audio: selectedAudioId ? { deviceId: { exact: selectedAudioId } } : true,
        }))

      recordedChunks.current = []
      const recorder = new MediaRecorder(stream)
      mediaRecorderRef.current = recorder

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunks.current.push(e.data)
      }

      recorder.onstop = () => {
        const audioBlob = new Blob(recordedChunks.current, { type: 'audio/webm' })
        const audioUrl = URL.createObjectURL(audioBlob)
        setTestState('playing')
        const audio = new Audio(audioUrl)
        audioElementRef.current = audio
        audio.onended = () => {
          setTestState('idle')
        }
        void audio.play()
      }

      recorder.start()
      setTestState('recording')
      setCountdown(3)

      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer)
            recorder.stop()
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } catch {
      setTestState('idle')
    }
  }

  const stopEchoTest = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
    if (audioElementRef.current) {
      audioElementRef.current.pause()
    }
    setTestState('idle')
  }

  if (!isOpen) return null

  return (
    <div
      className="dialog-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          stopEchoTest()
          onClose()
        }
      }}
    >
      <section className="create-dialog" role="dialog" aria-modal="true">
        <header>
          <span className="dialog-icon">
            <Volume2 size={19} />
          </span>
          <button
            className="plain-icon"
            onClick={() => {
              stopEchoTest()
              onClose()
            }}
            aria-label="Đóng"
          >
            <X size={18} />
          </button>
        </header>
        <h2>Kiểm tra thiết bị</h2>
        <p>Kiểm tra microphone, loa và camera để đảm bảo chất lượng cuộc họp tốt nhất.</p>

        <div className="form-group">
          <label>Microphone</label>
          <select
            className="modal-select"
            value={selectedAudioId}
            onChange={(e) => onSelectAudio(e.target.value)}
          >
            {devices.audioInputs.length === 0 && <option value="">Mặc định của hệ thống</option>}
            {devices.audioInputs.map((d, i) => (
              <option key={d.deviceId || i} value={d.deviceId}>
                {d.label || `Microphone ${i + 1}`}
              </option>
            ))}
          </select>
          <div className="mic-meter-wrap" style={{ marginTop: 8 }}>
            <span>Âm lượng micro:</span>
            <div className="meter-bar">
              <div className="meter-fill" style={{ width: `${micLevel}%` }} />
            </div>
            <span style={{ minWidth: 32, textAlign: 'right' }}>{micLevel}%</span>
          </div>
        </div>

        {/* Audio Echo Test */}
        <div className="echo-test-card">
          <div className="echo-test-info">
            <strong>Thử nghiệm âm thanh (Echo Test)</strong>
            <small>Nói một câu trong 3 giây và nghe lại để kiểm tra cả Micro và Loa của bạn.</small>
          </div>
          {testState === 'idle' && (
            <button className="button button-soft" onClick={() => void startEchoTest()}>
              <Play size={14} /> Nói thử & nghe lại
            </button>
          )}
          {testState === 'recording' && (
            <button className="button button-danger" onClick={stopEchoTest}>
              <Square size={13} /> Đang ghi âm ({countdown}s)... Bấm dừng
            </button>
          )}
          {testState === 'playing' && (
            <button className="button button-primary" onClick={stopEchoTest}>
              <Volume2 size={14} /> Đang phát lại âm thanh của bạn...
            </button>
          )}
        </div>

        <div className="form-group" style={{ marginTop: 16 }}>
          <label>Camera</label>
          <select
            className="modal-select"
            value={selectedVideoId}
            onChange={(e) => onSelectVideo(e.target.value)}
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
          <button
            className="button button-primary"
            onClick={() => {
              stopEchoTest()
              onClose()
            }}
          >
            <Check size={15} /> Xong
          </button>
        </footer>
      </section>
    </div>
  )
}
