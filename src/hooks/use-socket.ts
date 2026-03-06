import { useEffect, useRef, useState } from 'react'
import type { LogEntry } from '../lib/logger'

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

export default function useSocket() {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const [logs, setLogs] = useState<LogEntry[]>([])
  const socketRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    let reconnectTimeout: ReturnType<typeof setTimeout> | undefined

    const connect = () => {
      if (
        socketRef.current?.readyState === WebSocket.OPEN ||
        socketRef.current?.readyState === WebSocket.CONNECTING
      ) {
        return
      }

      setStatus('connecting')

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const wsUrl = `${protocol}//${window.location.host}/ws`

      const ws = new WebSocket(wsUrl)
      socketRef.current = ws

      ws.onopen = () => {
        setStatus('connected')
      }

      ws.onmessage = event => {
        try {
          const message = JSON.parse(event.data)
          if (message.type === 'log') {
            setLogs(prev => [...prev, message.payload])
          }
        } catch (e) {
          console.error('Failed to parse WebSocket message', e)
        }
      }

      ws.onclose = () => {
        setStatus('disconnected')
        socketRef.current = null
        // Reconnect after 3 seconds
        reconnectTimeout = setTimeout(connect, 3000)
      }

      ws.onerror = error => {
        console.error('WebSocket error:', error)
        setStatus('error')
      }
    }

    connect()

    return () => {
      clearTimeout(reconnectTimeout)
      if (socketRef.current) {
        socketRef.current.close()
      }
    }
  }, [])

  const clearLogs = () => setLogs([])

  return { status, logs, clearLogs }
}
