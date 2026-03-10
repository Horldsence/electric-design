import { useEffect, useRef, useState } from 'react'
import type { LogEntry } from '../lib/logger'

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

let sharedSocket: WebSocket | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | undefined
let deferredCloseTimer: ReturnType<typeof setTimeout> | undefined
let hasConnectedOnce = false
const logListeners = new Set<(entry: LogEntry) => void>()
const statusListeners = new Set<(status: ConnectionStatus) => void>()

const notifyStatus = (status: ConnectionStatus) => {
  statusListeners.forEach(listener => listener(status))
}

const connectSharedSocket = () => {
  if (
    sharedSocket?.readyState === WebSocket.OPEN ||
    sharedSocket?.readyState === WebSocket.CONNECTING
  ) {
    return
  }

  clearTimeout(reconnectTimer)
  clearTimeout(deferredCloseTimer)
  notifyStatus('connecting')

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const wsUrl = `${protocol}//${window.location.host}/ws`

  const ws = new WebSocket(wsUrl)
  sharedSocket = ws

  ws.onopen = () => {
    hasConnectedOnce = true
    notifyStatus('connected')
  }

  ws.onmessage = event => {
    try {
      const message = JSON.parse(event.data)
      if (message.type === 'log') {
        logListeners.forEach(listener => listener(message.payload as LogEntry))
      }
    } catch (e) {
      console.error('Failed to parse WebSocket message', e)
    }
  }

  ws.onclose = () => {
    if (sharedSocket === ws) {
      sharedSocket = null
    }
    notifyStatus('disconnected')
    reconnectTimer = setTimeout(connectSharedSocket, 3000)
  }

  ws.onerror = error => {
    console.error('WebSocket error:', error)
    notifyStatus(hasConnectedOnce ? 'disconnected' : 'error')
  }
}

export default function useSocket() {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const [logs, setLogs] = useState<LogEntry[]>([])
  const socketRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    const handleLog = (entry: LogEntry) => {
      setLogs(prev => [...prev, entry])
    }

    const handleStatus = (nextStatus: ConnectionStatus) => {
      setStatus(nextStatus)
    }

    logListeners.add(handleLog)
    statusListeners.add(handleStatus)
    clearTimeout(deferredCloseTimer)

    if (sharedSocket?.readyState === WebSocket.OPEN) {
      setStatus('connected')
    } else if (sharedSocket?.readyState === WebSocket.CONNECTING) {
      setStatus('connecting')
    } else {
      connectSharedSocket()
    }

    socketRef.current = sharedSocket

    return () => {
      logListeners.delete(handleLog)
      statusListeners.delete(handleStatus)

      if (logListeners.size === 0 && statusListeners.size === 0) {
        clearTimeout(reconnectTimer)
        clearTimeout(deferredCloseTimer)
        deferredCloseTimer = setTimeout(() => {
          if (logListeners.size === 0 && statusListeners.size === 0 && sharedSocket) {
            const ws = sharedSocket
            sharedSocket = null
            ws.close()
          }
        }, 150)
      }
    }
  }, [])

  const clearLogs = () => setLogs([])

  return { status, logs, clearLogs }
}
