import type { VercelRequest, VercelResponse } from '@vercel/node'
import { AccessToken } from 'livekit-server-sdk'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { roomName, participantName } = req.body ?? {}

  if (!roomName || !participantName) {
    return res.status(400).json({ error: 'roomName and participantName are required' })
  }

  const apiKey = process.env.LIVEKIT_API_KEY
  const apiSecret = process.env.LIVEKIT_API_SECRET

  if (!apiKey || !apiSecret) {
    return res.status(500).json({ error: 'LiveKit credentials not configured' })
  }

  const token = new AccessToken(apiKey, apiSecret, {
    identity: participantName,
    name: participantName,
    ttl: '30m',
  })

  token.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
  })

  const jwt = await token.toJwt()
  return res.status(200).json({ token: jwt })
}
