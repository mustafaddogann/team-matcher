import { useState, useEffect, useRef, useCallback } from 'react'
import { Room, RoomEvent } from 'livekit-client'
import type { Participant, RemoteTrack, RemoteTrackPublication, RemoteParticipant } from 'livekit-client'

const LIVEKIT_WS_URL = import.meta.env.VITE_LIVEKIT_WS_URL as string | undefined

interface VoiceParticipant {
  identity: string
  isSpeaking: boolean
}

export default function useDualVoiceChat(
  sessionId: string,
  teamChannel: string,
  activeChannel: string,
  playerName: string,
) {
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isMicMuted, setIsMicMuted] = useState(false)
  const [isDeafened, setIsDeafened] = useState(false)
  const [lobbyParticipants, setLobbyParticipants] = useState<VoiceParticipant[]>([])
  const [teamParticipants, setTeamParticipants] = useState<VoiceParticipant[]>([])
  const [error, setError] = useState<string | null>(null)

  const lobbyRoomRef = useRef<Room | null>(null)
  const teamRoomRef = useRef<Room | null>(null)
  const deafenedRef = useRef(false)
  const micMutedRef = useRef(false)

  const syncParticipants = useCallback((room: Room, setter: React.Dispatch<React.SetStateAction<VoiceParticipant[]>>) => {
    const all: VoiceParticipant[] = []
    all.push({
      identity: room.localParticipant.identity,
      isSpeaking: room.localParticipant.isSpeaking,
    })
    room.remoteParticipants.forEach((p) => {
      all.push({ identity: p.identity, isSpeaking: p.isSpeaking })
    })
    setter(all)
  }, [])

  const wireRoom = useCallback((room: Room, setter: React.Dispatch<React.SetStateAction<VoiceParticipant[]>>) => {
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
      syncParticipants(room, setter)
    })

    room.on(RoomEvent.ParticipantConnected, () => syncParticipants(room, setter))
    room.on(RoomEvent.ParticipantDisconnected, () => syncParticipants(room, setter))
  }, [syncParticipants])

  const joinVoice = useCallback(async () => {
    if (!LIVEKIT_WS_URL || isConnected || isConnecting) return

    setIsConnecting(true)
    setError(null)

    try {
      const lobbyRoomName = `${sessionId}:__lobby__`
      const teamRoomName = `${sessionId}:${teamChannel}`

      const [lobbyRes, teamRes] = await Promise.all([
        fetch('/api/livekit-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomName: lobbyRoomName, participantName: playerName }),
        }),
        fetch('/api/livekit-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomName: teamRoomName, participantName: playerName }),
        }),
      ])

      if (!lobbyRes.ok || !teamRes.ok) {
        const body = await (lobbyRes.ok ? teamRes : lobbyRes).json().catch(() => ({}))
        throw new Error(body.error || 'Failed to get voice token')
      }

      const [{ token: lobbyToken }, { token: teamToken }] = await Promise.all([
        lobbyRes.json(),
        teamRes.json(),
      ])

      const lobbyRoom = new Room()
      const teamRoom = new Room()

      wireRoom(lobbyRoom, setLobbyParticipants)
      wireRoom(teamRoom, setTeamParticipants)

      lobbyRoom.on(RoomEvent.Disconnected, () => {
        lobbyRoomRef.current = null
        setLobbyParticipants([])
        // If both rooms are gone, mark disconnected
        if (!teamRoomRef.current) {
          setIsConnected(false)
        }
      })

      teamRoom.on(RoomEvent.Disconnected, () => {
        teamRoomRef.current = null
        setTeamParticipants([])
        if (!lobbyRoomRef.current) {
          setIsConnected(false)
        }
      })

      await Promise.all([
        lobbyRoom.connect(LIVEKIT_WS_URL, lobbyToken),
        teamRoom.connect(LIVEKIT_WS_URL, teamToken),
      ])

      lobbyRoomRef.current = lobbyRoom
      teamRoomRef.current = teamRoom
      setIsConnected(true)

      syncParticipants(lobbyRoom, setLobbyParticipants)
      syncParticipants(teamRoom, setTeamParticipants)

      // Enable mic only on the active channel's room
      const activeRoom = activeChannel === '__lobby__' ? lobbyRoom : teamRoom
      const inactiveRoom = activeChannel === '__lobby__' ? teamRoom : lobbyRoom

      try {
        await activeRoom.localParticipant.setMicrophoneEnabled(true)
        setIsMicMuted(false)
        micMutedRef.current = false
      } catch {
        setIsMicMuted(true)
        micMutedRef.current = true
        setError('No microphone found — you can still listen')
      }

      // Make sure inactive room mic is off
      try {
        await inactiveRoom.localParticipant.setMicrophoneEnabled(false)
      } catch {
        // ignore
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join voice')
    } finally {
      setIsConnecting(false)
    }
  }, [sessionId, teamChannel, activeChannel, playerName, isConnected, isConnecting, syncParticipants, wireRoom])

  const leaveVoice = useCallback(async () => {
    const lobby = lobbyRoomRef.current
    const team = teamRoomRef.current

    await Promise.all([
      lobby?.disconnect(),
      team?.disconnect(),
    ])

    lobbyRoomRef.current = null
    teamRoomRef.current = null
    setIsConnected(false)
    setIsMicMuted(false)
    micMutedRef.current = false
    setIsDeafened(false)
    deafenedRef.current = false
    setLobbyParticipants([])
    setTeamParticipants([])
  }, [])

  // Mic switching: when activeChannel changes, move mic to the new active room
  useEffect(() => {
    if (!isConnected) return

    const lobbyRoom = lobbyRoomRef.current
    const teamRoom = teamRoomRef.current
    if (!lobbyRoom || !teamRoom) return

    const newActive = activeChannel === '__lobby__' ? lobbyRoom : teamRoom
    const newInactive = activeChannel === '__lobby__' ? teamRoom : lobbyRoom

    const micEnabled = !micMutedRef.current

    // Disable mic on the room we're leaving, enable on the one we're entering
    newInactive.localParticipant.setMicrophoneEnabled(false).catch(() => {})
    newActive.localParticipant.setMicrophoneEnabled(micEnabled).catch(() => {})
  }, [activeChannel, isConnected])

  const toggleMic = useCallback(async () => {
    const activeRoom = activeChannel === '__lobby__' ? lobbyRoomRef.current : teamRoomRef.current
    if (!activeRoom) return

    const newMuted = !isMicMuted
    await activeRoom.localParticipant.setMicrophoneEnabled(!newMuted)
    setIsMicMuted(newMuted)
    micMutedRef.current = newMuted
  }, [isMicMuted, activeChannel])

  const toggleDeafen = useCallback(() => {
    const newDeafened = !isDeafened
    document.querySelectorAll<HTMLAudioElement>('audio[id^="lk-audio-"]').forEach((el) => {
      el.muted = newDeafened
    })
    deafenedRef.current = newDeafened
    setIsDeafened(newDeafened)
  }, [isDeafened])

  // Disconnect both rooms on unmount or sessionId/teamChannel change
  useEffect(() => {
    return () => {
      lobbyRoomRef.current?.disconnect()
      teamRoomRef.current?.disconnect()
      lobbyRoomRef.current = null
      teamRoomRef.current = null
    }
  }, [sessionId, teamChannel])

  return {
    isConnected,
    isConnecting,
    isMicMuted,
    isDeafened,
    lobbyParticipants,
    teamParticipants,
    error,
    joinVoice,
    leaveVoice,
    toggleMic,
    toggleDeafen,
    enabled: !!LIVEKIT_WS_URL,
  }
}
