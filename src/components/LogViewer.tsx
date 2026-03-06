import React, { useEffect, useRef } from 'react'
import type { LogEntry } from '../lib/logger'

interface LogViewerProps {
  logs: LogEntry[]
  style?: React.CSSProperties
  className?: string
}

const styles = {
  container: {
    backgroundColor: '#1e1e1e',
    color: '#d4d4d4',
    fontFamily: 'Consolas, "Courier New", monospace',
    fontSize: '12px',
    padding: '10px',
    borderRadius: '6px',
    overflowY: 'auto' as const,
    height: '400px',
    border: '1px solid #333',
    lineHeight: '1.4',
    textAlign: 'left' as const,
  },
  entry: {
    marginBottom: '4px',
    wordBreak: 'break-all' as const,
  },
  timestamp: {
    color: '#808080',
    marginRight: '8px',
  },
  level: {
    display: 'inline-block',
    width: '50px',
    fontWeight: 'bold' as const,
    marginRight: '8px',
  },
  context: {
    color: '#569cd6',
    marginRight: '8px',
  },
  message: {
    color: '#d4d4d4',
  },
  data: {
    color: '#9cdcfe',
    marginLeft: '20px',
    whiteSpace: 'pre-wrap' as const,
  },
  error: {
    color: '#f48771',
    marginLeft: '20px',
    whiteSpace: 'pre-wrap' as const,
  },
  levels: {
    debug: { color: '#808080' },
    info: { color: '#6a9955' },
    warn: { color: '#dcdcaa' },
    error: { color: '#f48771' },
  },
}

const formatTime = (timestamp: number) => {
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
  })
}

export const LogViewer: React.FC<LogViewerProps> = ({ logs, style, className }) => {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [logs])

  return (
    <div style={{ ...styles.container, ...style }} className={className} ref={scrollRef}>
      {logs.length === 0 && <div style={{ color: '#666', fontStyle: 'italic' }}>Waiting for logs...</div>}
      {logs.map((log, i) => (
        <div key={i} style={styles.entry}>
          <span style={styles.timestamp}>[{formatTime(log.timestamp)}]</span>
          <span
            style={{
              ...styles.level,
              color: styles.levels[log.level]?.color || styles.levels.info.color,
            }}
          >
            {log.level.toUpperCase()}
          </span>
          <span style={styles.context}>{log.context}</span>
          <span style={styles.message}>{log.message}</span>
          {log.duration && <span style={{ color: '#c586c0', marginLeft: '8px' }}>({log.duration}ms)</span>}
          {log.data && <div style={styles.data}>{JSON.stringify(log.data, null, 2)}</div>}
          {log.error && (
            <div style={styles.error}>
              <div>
                {log.error.name}: {log.error.message}
              </div>
              {log.error.stack && <div style={{ opacity: 0.7 }}>{log.error.stack}</div>}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}