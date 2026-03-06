import type React from 'react'
import { useEffect, useRef, useState } from 'react'
import type { LogEntry } from '../lib/logger'

interface LogViewerProps {
  logs: LogEntry[]
  style?: React.CSSProperties
  className?: string
  onClear?: () => void
}

const styles = {
  toolbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '6px 10px',
    backgroundColor: '#141414',
    borderRadius: '6px 6px 0 0',
    border: '1px solid #333',
    borderBottom: 'none',
  },
  logCount: {
    fontSize: '11px',
    color: '#666',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  },
  toolbarButtons: {
    display: 'flex',
    gap: '6px',
  },
  toolbarButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '24px',
    height: '24px',
    backgroundColor: 'transparent',
    border: '1px solid #2a2a2a',
    borderRadius: '4px',
    color: '#666',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  container: {
    backgroundColor: '#1e1e1e',
    color: '#d4d4d4',
    fontFamily: 'Consolas, "Courier New", monospace',
    fontSize: '12px',
    padding: '10px',
    borderRadius: '0 0 6px 6px',
    overflowY: 'auto' as const,
    flex: 1,
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
  scrollToBottomButton: {
    position: 'absolute' as const,
    bottom: '16px',
    right: '16px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 12px',
    backgroundColor: '#fbf0df',
    color: '#222',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: '12px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
    transition: 'all 0.2s',
    zIndex: 10,
  },
}

const formatTime = (timestamp: number) => {
  return new Date(timestamp).toLocaleTimeString('zh-CN', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
  })
}

export const LogViewer: React.FC<LogViewerProps> = ({ logs, style, className, onClear }) => {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(true)
  const [showScrollButton, setShowScrollButton] = useState(false)

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (scrollRef.current && autoScroll) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [autoScroll])

  // Detect if user has scrolled away from bottom
  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50
      setAutoScroll(isAtBottom)
      setShowScrollButton(!isAtBottom)
    }
  }

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
      setAutoScroll(true)
      setShowScrollButton(false)
    }
  }

  const handleClearLogs = () => {
    if (onClear) {
      onClear()
    }
  }

  return (
    <div
      className={className}
      style={{
        position: 'relative',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
      }}
    >
      {/* Toolbar */}
      <div style={styles.toolbar}>
        <div style={styles.logCount}>{logs.length} 条日志</div>
        <div style={styles.toolbarButtons}>
          <button
            type="button"
            onClick={scrollToBottom}
            style={styles.toolbarButton}
            title="滚动到底部"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
              <title>滚动到底部</title>
              <path
                d="M7 2v8M3 6l4 4 4-4"
                stroke="currentColor"
                strokeWidth="1.5"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          {onClear && (
            <button
              type="button"
              onClick={handleClearLogs}
              style={styles.toolbarButton}
              title="清除日志"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                <title>清除日志</title>
                <path
                  d="M2 4h10M5 4V3a1 1 0 011-1h2a1 1 0 011 1v1M5 7v4M9 7v4M4 4l.5 7a1 1 0 001 1h3a1 1 0 001-1l.5-7"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  fill="none"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Log Container */}
      <div style={{ ...styles.container, ...style }} ref={scrollRef} onScroll={handleScroll}>
        {logs.length === 0 && <div style={{ color: '#666', fontStyle: 'italic' }}>等待日志...</div>}
        {logs.map(log => (
          <div key={`${log.timestamp}-${log.context}-${log.message}`} style={styles.entry}>
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
            {log.duration && (
              <span style={{ color: '#c586c0', marginLeft: '8px' }}>({log.duration}ms)</span>
            )}
            {log.data && (
              <div style={styles.data}>
                <pre style={{ margin: 0 }}>{JSON.stringify(log.data, null, 2) || ''}</pre>
              </div>
            )}
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

      {/* Scroll to Bottom Button */}
      {showScrollButton && (
        <button
          type="button"
          onClick={scrollToBottom}
          style={styles.scrollToBottomButton}
          title="滚动到底部 (新消息)"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <title>滚动到底部 (新消息)</title>
            <path
              d="M8 3v10M4 9l4 4 4-4"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span style={{ fontSize: '11px', fontWeight: 600 }}>新消息</span>
        </button>
      )}
    </div>
  )
}
