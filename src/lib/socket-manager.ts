import type { ServerWebSocket } from 'bun'
import { logger } from './logger'
import type { LogEntry } from './logger'

export type WebSocketData = {
  id: string
  createdAt: number
}

export type WebSocketMessage = {
  type: string
  payload?: any
}

class SocketManager {
  private clients: Set<ServerWebSocket<WebSocketData>> = new Set()

  constructor() {
    // Hook into the logger to broadcast logs to all connected clients
    logger.onLog((entry: LogEntry) => {
      this.broadcast({
        type: 'log',
        payload: entry,
      })
    })
  }

  handleOpen(ws: ServerWebSocket<WebSocketData>) {
    this.clients.add(ws)

    // Send initial connection success message
    ws.send(
      JSON.stringify({
        type: 'connected',
        payload: {
          id: ws.data.id,
          clientCount: this.clients.size,
        },
      }),
    )

    logger.debug('socket', `Client connected: ${ws.data.id}`)
  }

  handleMessage(ws: ServerWebSocket<WebSocketData>, message: string | Buffer) {
    try {
      const data = typeof message === 'string' ? JSON.parse(message) : message
      // Future: handle client messages
    } catch (e) {
      logger.error('socket', 'Failed to parse message', e)
    }
  }

  handleClose(ws: ServerWebSocket<WebSocketData>) {
    this.clients.delete(ws)
    logger.debug('socket', `Client disconnected: ${ws.data.id}`)
  }

  broadcast(message: WebSocketMessage) {
    const msgString = JSON.stringify(message)
    for (const client of this.clients) {
      // 1 = OPEN
      if (client.readyState === 1) {
        client.send(msgString)
      }
    }
  }
}

export const socketManager = new SocketManager()