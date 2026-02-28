import { useState, useEffect, useRef, useCallback } from 'react'
import { Room, RoomEvent } from 'livekit-client'
import type { Participant, RemoteTrack, RemoteTrackPublication, RemoteParticipant } from 'livekit-client'

const LIVEKIT_WS_URL = import.meta.env.VITE_LIVEKIT_WS_URL as string | undefined
const AUDIO_OWNER_ATTR = 'data-tm-voice'
const AUDIO_OWNER_VALUE = 'join-page'

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
  const [isSwitching, setIsSwitching] = useState(false)
  const [isMicMuted, setIsMicMuted] = useState(false)
  const [isDeafened, setIsDeafened] = useState(false)
  const [participants, setParticipants] = useState<VoiceParticipant[]>([])
  const [error, setError] = useState<string | null>(null)

  const roomRef = useRef<Room | null>(null)
  const connectedChannelRef = useRef<string | null>(null)
  const deafenedRef = useRef(false)
  const micMutedRef = useRef(false)
  const desiredChannelRef = useRef(channel)
  const actionChainRef = useRef(Promise.resolve())
  const mountedRef = useRef(true)

  const cleanupAttachedAudio = useCallback(() => {
    document
      .querySelectorAll<HTMLAudioElement>(`audio[${AUDIO_OWNER_ATTR}="${AUDIO_OWNER_VALUE}"]`)
      .forEach((el) => {
        el.srcObject = null
        el.remove()
      })
  }, [])

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

  const wireRoom = useCallback((room: Room) => {
    room.on(
      RoomEvent.TrackSubscribed,
      (track: RemoteTrack, _pub: RemoteTrackPublication, _participant: RemoteParticipant) => {
        if (track.kind === 'audio') {
          const el = track.attach()
          el.id = `lk-audio-${track.sid}`
          el.setAttribute(AUDIO_OWNER_ATTR, AUDIO_OWNER_VALUE)
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
      if (roomRef.current === room) {
        roomRef.current = null
        connectedChannelRef.current = null
        setParticipants([])
        setIsConnected(false)
      }
      cleanupAttachedAudio()
    })
  }, [cleanupAttachedAudio, syncParticipants])

  const disconnectCurrentRoom = useCallback(async (preservePreferences: boolean) => {
    const room = roomRef.current
    roomRef.current = null
    connectedChannelRef.current = null

    if (room) {
      await room.disconnect()
    }

    cleanupAttachedAudio()
    setParticipants([])
    setIsConnected(false)

    if (!preservePreferences) {
      micMutedRef.current = false
      deafenedRef.current = false
      setIsMicMuted(false)
      setIsDeafened(false)
    }
  }, [cleanupAttachedAudio])

  const connectToChannel = useCallback(async (targetChannel: string) => {
    if (!LIVEKIT_WS_URL) return

    const roomName = `${sessionId}:${targetChannel}`
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

    wireRoom(room)
    await room.connect(LIVEKIT_WS_URL, token)

    roomRef.current = room
    connectedChannelRef.current = targetChannel
    setIsConnected(true)
    syncParticipants(room)

    if (micMutedRef.current) {
      await room.localParticipant.setMicrophoneEnabled(false).catch(() => {})
      setIsMicMuted(true)
      return
    }

    try {
      await room.localParticipant.setMicrophoneEnabled(true)
      setIsMicMuted(false)
      micMutedRef.current = false
      setError(null)
    } catch {
      micMutedRef.current = true
      setIsMicMuted(true)
      setError('No microphone found — you can still listen')
    }
  }, [playerName, sessionId, syncParticipants, wireRoom])

  const enqueueAction = useCallback((task: () => Promise<void>) => {
    actionChainRef.current = actionChainRef.current
      .catch(() => {})
      .then(task)
    return actionChainRef.current
  }, [])

  const syncToDesiredChannel = useCallback(async () => {
    const targetChannel = desiredChannelRef.current
    if (!LIVEKIT_WS_URL || !targetChannel) return

    const currentChannel = connectedChannelRef.current
    if (currentChannel === targetChannel && roomRef.current) {
      return
    }

    const isChangingRooms = !!roomRef.current && currentChannel !== targetChannel

    if (!mountedRef.current) return
    setError(null)
    if (isChangingRooms) {
      setIsSwitching(true)
    } else {
      setIsConnecting(true)
    }

    try {
      if (isChangingRooms) {
        await disconnectCurrentRoom(true)
      }

      // Another channel was requested while disconnecting; honor the latest request.
      const latestTarget = desiredChannelRef.current
      if (!latestTarget) return

      await connectToChannel(latestTarget)
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to switch voice channel')
      }
    } finally {
      if (mountedRef.current) {
        setIsConnecting(false)
        setIsSwitching(false)
      }
    }
  }, [connectToChannel, disconnectCurrentRoom])

  const joinVoice = useCallback(async () => {
    if (!LIVEKIT_WS_URL || isConnecting || isSwitching) return

    desiredChannelRef.current = channel
    await enqueueAction(syncToDesiredChannel)
  }, [channel, enqueueAction, isConnecting, isSwitching])

  const leaveVoice = useCallback(async () => {
    desiredChannelRef.current = ''
    await enqueueAction(async () => {
      if (!roomRef.current) return

      if (mountedRef.current) {
        setIsConnecting(true)
        setIsSwitching(false)
      }

      try {
        await disconnectCurrentRoom(false)
        if (mountedRef.current) {
          setError(null)
        }
      } finally {
        if (mountedRef.current) {
          setIsConnecting(false)
          setIsSwitching(false)
        }
      }
    })
  }, [disconnectCurrentRoom, enqueueAction])

  const toggleMic = useCallback(async () => {
    const room = roomRef.current
    if (!room) return

    const newMuted = !micMutedRef.current
    await room.localParticipant.setMicrophoneEnabled(!newMuted)
    micMutedRef.current = newMuted
    setIsMicMuted(newMuted)
  }, [])

  const toggleDeafen = useCallback(() => {
    const newDeafened = !deafenedRef.current
    document
      .querySelectorAll<HTMLAudioElement>(`audio[${AUDIO_OWNER_ATTR}="${AUDIO_OWNER_VALUE}"]`)
      .forEach((el) => {
        el.muted = newDeafened
      })
    deafenedRef.current = newDeafened
    setIsDeafened(newDeafened)
  }, [])

  useEffect(() => {
    desiredChannelRef.current = channel
    if (!roomRef.current) return
    if (connectedChannelRef.current === channel) return

    void enqueueAction(syncToDesiredChannel)
  }, [channel, enqueueAction, syncToDesiredChannel])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      void disconnectCurrentRoom(false)
    }
  }, [disconnectCurrentRoom])

  return {
    isConnected,
    isConnecting,
    isSwitching,
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
