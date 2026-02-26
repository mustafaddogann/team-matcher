import { useState, useEffect, useRef, useCallback } from 'react'
import { Room, RoomEvent } from 'livekit-client'
import type { Participant, RemoteTrack, RemoteTrackPublication, RemoteParticipant } from 'livekit-client'

const LIVEKIT_WS_URL = import.meta.env.VITE_LIVEKIT_WS_URL as string | undefined

interface VoiceParticipant {
  identity: string
  isSpeaking: boolean
}

export default function useVoiceChat(
  sessionId: string,
  channel: string,
  playerName: string,
) {
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isMicMuted, setIsMicMuted] = useState(false)
  const [isDeafened, setIsDeafened] = useState(false)
  const [participants, setParticipants] = useState<VoiceParticipant[]>([])
  const [error, setError] = useState<string | null>(null)

  const roomRef = useRef<Room | null>(null)
  const deafenedRef = useRef(false)

  const syncParticipants = useCallback((room: Room) => {
    const all: VoiceParticipant[] = []

    all.push({
      identity: room.localParticipant.identity,
      isSpeaking: room.localParticipant.isSpeaking,
    })

    room.remoteParticipants.forEach((p) => {
      all.push({ identity: p.identity, isSpeaking: p.isSpeaking })
    })

    setParticipants(all)
  }, [])

  const joinVoice = useCallback(async () => {
    if (!LIVEKIT_WS_URL || isConnected || isConnecting) return

    setIsConnecting(true)
    setError(null)

    try {
      const roomName = `${sessionId}:${channel}`
      const res = await fetch('/api/livekit-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomName, participantName: playerName }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Failed to get voice token')
      }

      const { token } = await res.json()

      const room = new Room()

      room.on(
        RoomEvent.TrackSubscribed,
        (track: RemoteTrack, _pub: RemoteTrackPublication, _participant: RemoteParticipant) => {
          if (track.kind === 'audio') {
            const el = track.attach()
            el.id = `lk-audio-${track.sid}`
            el.muted = deafenedRef.current
            document.body.appendChild(el)
          }
        },
      )

      room.on(
        RoomEvent.TrackUnsubscribed,
        (track: RemoteTrack) => {
          track.detach().forEach((el) => el.remove())
        },
      )

      room.on(RoomEvent.ActiveSpeakersChanged, (_speakers: Participant[]) => {
        syncParticipants(room)
      })

      room.on(RoomEvent.ParticipantConnected, () => syncParticipants(room))
      room.on(RoomEvent.ParticipantDisconnected, () => syncParticipants(room))

      room.on(RoomEvent.Disconnected, () => {
        setIsConnected(false)
        setParticipants([])
        roomRef.current = null
      })

      await room.connect(LIVEKIT_WS_URL, token)

      roomRef.current = room
      setIsConnected(true)
      syncParticipants(room)

      try {
        await room.localParticipant.setMicrophoneEnabled(true)
        setIsMicMuted(false)
      } catch {
        setIsMicMuted(true)
        setError('No microphone found — you can still listen')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join voice')
    } finally {
      setIsConnecting(false)
    }
  }, [sessionId, channel, playerName, isConnected, isConnecting, syncParticipants])

  const leaveVoice = useCallback(async () => {
    const room = roomRef.current
    if (!room) return

    await room.disconnect()
    roomRef.current = null
    setIsConnected(false)
    setIsMicMuted(false)
    setIsDeafened(false)
    deafenedRef.current = false
    setParticipants([])
  }, [])

  const toggleMic = useCallback(async () => {
    const room = roomRef.current
    if (!room) return

    const newMuted = !isMicMuted
    await room.localParticipant.setMicrophoneEnabled(!newMuted)
    setIsMicMuted(newMuted)
  }, [isMicMuted])

  const toggleDeafen = useCallback(() => {
    const newDeafened = !isDeafened
    document.querySelectorAll<HTMLAudioElement>('audio[id^="lk-audio-"]').forEach((el) => {
      el.muted = newDeafened
    })
    deafenedRef.current = newDeafened
    setIsDeafened(newDeafened)
  }, [isDeafened])

  // Disconnect on channel/session change
  useEffect(() => {
    return () => {
      const room = roomRef.current
      if (room) {
        room.disconnect()
        roomRef.current = null
      }
    }
  }, [sessionId, channel])

  return {
    isConnected,
    isConnecting,
    isMicMuted,
    isDeafened,
    participants,
    error,
    joinVoice,
    leaveVoice,
    toggleMic,
    toggleDeafen,
    enabled: !!LIVEKIT_WS_URL,
  }
}
