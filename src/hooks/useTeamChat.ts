import { useState, useEffect, useRef, useCallback } from 'react'
import { getSupabase } from '../lib/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'

interface ChatMessage {
  id: string
  session_id: string
  channel: string
  sender_name: string
  body: string
  sent_at: string
}

export default function useTeamChat(
  sessionId: string,
  channel: string,
  playerName: string,
) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isSending, setIsSending] = useState(false)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const optimisticIds = useRef<Set<string>>(new Set())
  // Track known IDs so polling merges cleanly without duplicates
  const knownIds = useRef<Set<string>>(new Set())

  const fetchMessages = useCallback(async () => {
    const supabase = getSupabase()
    if (!supabase || !sessionId || !channel) return

    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .eq('channel', channel)
      .order('sent_at', { ascending: true })

    if (data) {
      const serverIds = new Set(data.map((m) => m.id))
      // Merge: keep optimistic messages not yet confirmed, replace rest with server data
      setMessages((prev) => {
        const pendingOptimistic = prev.filter(
          (m) => optimisticIds.current.has(m.id) && !serverIds.has(m.id),
        )
        return [...data, ...pendingOptimistic]
      })
      // Update known IDs
      knownIds.current = serverIds
    }
  }, [sessionId, channel])

  // Fetch existing + subscribe to realtime + poll as fallback
  useEffect(() => {
    const supabase = getSupabase()
    if (!supabase || !sessionId || !channel) return

    // Reset on channel change
    setMessages([])
    optimisticIds.current.clear()
    knownIds.current.clear()

    // 1. Initial fetch
    fetchMessages()

    // 2. Realtime subscription for instant delivery
    const sub = supabase
      .channel(`chat:${sessionId}:${channel}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const msg = payload.new as ChatMessage
          if (msg.channel !== channel) return
          if (knownIds.current.has(msg.id)) return
          knownIds.current.add(msg.id)
          // Dedup against optimistic inserts
          if (optimisticIds.current.has(msg.id)) {
            optimisticIds.current.delete(msg.id)
            // Replace optimistic with server version
            setMessages((prev) =>
              prev.map((m) => (m.id === msg.id ? msg : m)),
            )
            return
          }
          setMessages((prev) => [...prev, msg])
        },
      )
      .subscribe()

    channelRef.current = sub

    // 3. Polling fallback — catches anything Realtime misses
    const poll = setInterval(fetchMessages, 2000)

    return () => {
      sub.unsubscribe()
      channelRef.current = null
      clearInterval(poll)
    }
  }, [sessionId, channel, fetchMessages])

  const sendMessage = useCallback(
    async (body: string) => {
      const trimmed = body.trim()
      if (!trimmed || isSending) return

      const supabase = getSupabase()
      if (!supabase) return

      setIsSending(true)

      // Optimistic insert
      const optimisticId = crypto.randomUUID()
      const optimistic: ChatMessage = {
        id: optimisticId,
        session_id: sessionId,
        channel,
        sender_name: playerName,
        body: trimmed,
        sent_at: new Date().toISOString(),
      }
      optimisticIds.current.add(optimisticId)
      setMessages((prev) => [...prev, optimistic])

      try {
        const { data, error } = await supabase
          .from('chat_messages')
          .insert({
            id: optimisticId,
            session_id: sessionId,
            channel,
            sender_name: playerName,
            body: trimmed,
          })
          .select()
          .single()

        if (error) throw error

        if (data) {
          optimisticIds.current.delete(optimisticId)
          knownIds.current.add(data.id)
          setMessages((prev) =>
            prev.map((m) => (m.id === optimisticId ? data : m)),
          )
        }
      } catch {
        optimisticIds.current.delete(optimisticId)
        setMessages((prev) => prev.filter((m) => m.id !== optimisticId))
      } finally {
        setIsSending(false)
      }
    },
    [sessionId, channel, playerName, isSending],
  )

  return { messages, sendMessage, isSending }
}
