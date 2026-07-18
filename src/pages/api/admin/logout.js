import { cookieBorrar } from '../../../lib/adminAuth'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  res.setHeader('Set-Cookie', cookieBorrar())
  res.status(200).json({ ok: true })
}
