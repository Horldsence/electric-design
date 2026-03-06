import React, { useState, useRef, useEffect } from 'react'

interface SchematicViewerProps {
  pcbSvg?: string | null
  schematicSvg?: string | null
  circuitJson?: any[] | null
  className?: string
}

type ViewMode = 'pcb' | 'schematic'

export const SchematicViewer: React.FC<SchematicViewerProps> = ({
  pcbSvg,
  schematicSvg,
  circuitJson,
  className,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('pcb')
  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const containerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === '=' || e.key === '+') {
          e.preventDefault()
          handleZoomIn()
        } else if (e.key === '-') {
          e.preventDefault()
          handleZoomOut()
        } else if (e.key === '0') {
          e.preventDefault()
          handleResetView()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Reset view when content changes
  useEffect(() => {
    setScale(1)
    setPosition({ x: 0, y: 0 })
  }, [pcbSvg, schematicSvg, viewMode])

  const handleZoomIn = () => {
    setScale((prev) => Math.min(prev * 1.2, 5))
  }

  const handleZoomOut = () => {
    setScale((prev) => Math.max(prev / 1.2, 0.1))
  }

  const handleResetView = () => {
    setScale(1)
    setPosition({ x: 0, y: 0 })
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      // Left mouse button
      setIsDragging(true)
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      })
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      })
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleMouseLeave = () => {
    setIsDragging(false)
  }

  const handleWheel = (e: React.WheelEvent) => {
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    setScale((prev) => Math.max(0.1, Math.min(5, prev * delta)))
  }

  // Add wheel event listener with { passive: false } to allow preventDefault
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleWheelEvent = (e: WheelEvent) => {
      e.preventDefault()
      const delta = e.deltaY > 0 ? 0.9 : 1.1
      setScale((prev) => Math.max(0.1, Math.min(5, prev * delta)))
    }

    container.addEventListener('wheel', handleWheelEvent, { passive: false })
    return () => {
      container.removeEventListener('wheel', handleWheelEvent)
    }
  }, [])

  const renderContent = () => {
    // Choose which SVG to display based on view mode
    const currentSvg = viewMode === 'pcb' ? pcbSvg : schematicSvg
    
    if (!currentSvg) {
      const isSchematicMissing = viewMode === 'schematic' && pcbSvg && !schematicSvg
      const isPcbMissing = viewMode === 'pcb' && !pcbSvg
      
      return (
        <div className="placeholder-content">
          <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
            <circle cx="60" cy="60" r="50" stroke="#333" strokeWidth="2" strokeDasharray="4 4" />
            <path
              d="M40 60h40M60 40v40"
              stroke="#333"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          <p className="placeholder-text">
            {isSchematicMissing 
              ? '原理图视图暂不可用' 
              : isPcbMissing
              ? 'PCB视图暂不可用'
              : '准备就绪，可以开始生成电路设计'}
          </p>
          {isSchematicMissing && (
            <p className="placeholder-hint">
              原理图生成失败或不支持。请尝试切换到PCB视图查看电路板布局。
            </p>
          )}
        </div>
      )
    }

    return (
      <div
        className="svg-content"
        style={{
          transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
          transformOrigin: 'center center',
          transition: isDragging ? 'none' : 'transform 0.1s ease-out',
        }}
        dangerouslySetInnerHTML={{ __html: currentSvg }}
      />
    )
  }

  return (
    <div className={`schematic-viewer ${className || ''}`}>
      {/* Toolbar */}
      <div className="viewer-toolbar">
        {/* View Mode Toggle */}
        <div className="view-mode-toggle">
          <button
            className={`mode-btn ${viewMode === 'pcb' ? 'active' : ''}`}
            onClick={() => setViewMode('pcb')}
            title={pcbSvg ? 'PCB视图' : 'PCB视图不可用'}
            disabled={!pcbSvg}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <rect x="2" y="2" width="12" height="12" rx="1" stroke="currentColor" fill="none" />
              <circle cx="5" cy="5" r="1.5" />
              <circle cx="11" cy="5" r="1.5" />
              <circle cx="5" cy="11" r="1.5" />
              <circle cx="11" cy="11" r="1.5" />
            </svg>
            <span>PCB</span>
          </button>
          <button
            className={`mode-btn ${viewMode === 'schematic' ? 'active' : ''}`}
            onClick={() => setViewMode('schematic')}
            title={schematicSvg ? '原理图视图' : '原理图视图不可用'}
            disabled={!schematicSvg}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M2 8h4M10 8h4M8 2v4M8 10v4" stroke="currentColor" strokeWidth="1.5" fill="none" />
              <circle cx="8" cy="8" r="2" stroke="currentColor" fill="none" />
            </svg>
            <span>原理图</span>
            {!schematicSvg && pcbSvg && (
              <span className="unavailable-badge">N/A</span>
            )}
          </button>
        </div>

        {/* Zoom Controls */}
        <div className="zoom-controls">
          <button onClick={handleZoomOut} className="control-btn" title="缩小 (Ctrl + -)">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4 8h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          <span className="zoom-level">{Math.round(scale * 100)}%</span>
          <button onClick={handleZoomIn} className="control-btn" title="放大 (Ctrl + +)">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 4v8M4 8h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          <button onClick={handleResetView} className="control-btn" title="重置视图 (Ctrl + 0)">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path
                d="M8 2v3M2 8h3M8 11v3M11 8h3"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <circle cx="8" cy="8" r="3" stroke="currentColor" fill="none" strokeWidth="1.5" />
            </svg>
          </button>
        </div>

        {/* Info */}
        <div className="viewer-info">
          <span className="info-text">拖拽移动 · 滚轮缩放</span>
        </div>
      </div>

      {/* Viewer Canvas */}
      <div
        ref={containerRef}
        className={`viewer-canvas ${isDragging ? 'dragging' : ''}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        <div ref={contentRef} className="viewer-content">
          {renderContent()}
        </div>
      </div>

      <style>{`
        .schematic-viewer {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: #0a0a0a;
          border: 1px solid #333;
          border-radius: 8px;
          overflow: hidden;
        }

        .viewer-toolbar {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 12px;
          background: #141414;
          border-bottom: 1px solid #333;
          flex-shrink: 0;
        }

        .view-mode-toggle {
          display: flex;
          gap: 4px;
          background: #0a0a0a;
          padding: 3px;
          border-radius: 6px;
          border: 1px solid #2a2a2a;
        }

        .mode-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          background: transparent;
          border: none;
          color: #888;
          font-size: 12px;
          font-weight: 500;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.2s;
          white-space: nowrap;
        }

        .mode-btn:hover:not(:disabled) {
          background: #1a1a1a;
          color: #aaa;
        }

        .mode-btn.active {
          background: #2a2a2a;
          color: #fbf0df;
        }

        .mode-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .unavailable-badge {
          font-size: 9px;
          padding: 2px 4px;
          background: #ff6b6b;
          color: #fff;
          border-radius: 3px;
          margin-left: 4px;
          font-weight: 700;
        }

        .mode-btn svg {
          flex-shrink: 0;
        }

        .zoom-controls {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-left: auto;
        }

        .control-btn {
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #1a1a1a;
          border: 1px solid #2a2a2a;
          border-radius: 4px;
          color: #888;
          cursor: pointer;
          transition: all 0.2s;
        }

        .control-btn:hover {
          background: #2a2a2a;
          color: #ddd;
          border-color: #3a3a3a;
        }

        .control-btn:active {
          transform: scale(0.95);
        }

        .zoom-level {
          font-size: 12px;
          font-weight: 600;
          color: #888;
          min-width: 48px;
          text-align: center;
          font-variant-numeric: tabular-nums;
        }

        .viewer-info {
          display: flex;
          align-items: center;
          margin-left: 12px;
          padding-left: 12px;
          border-left: 1px solid #2a2a2a;
        }

        .info-text {
          font-size: 11px;
          color: #555;
          font-weight: 500;
        }

        .viewer-canvas {
          flex: 1;
          position: relative;
          overflow: hidden;
          min-width: 0;
          min-height: 0;
          cursor: grab;
          background-image:
            linear-gradient(#1a1a1a 1px, transparent 1px),
            linear-gradient(90deg, #1a1a1a 1px, transparent 1px);
          background-size: 20px 20px;
          background-position: center center;
          touch-action: none;
        }

        .viewer-canvas.dragging {
          cursor: grabbing;
        }

        .viewer-content {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
        }

        .svg-content {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          will-change: transform;
        }

        .svg-content svg {
          display: block;
          max-width: none;
          max-height: none;
          filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.5));
        }

        .placeholder-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 16px;
          color: #444;
          text-align: center;
          padding: 40px;
        }

        .placeholder-text {
          font-size: 13px;
          color: #444;
          font-style: italic;
          max-width: 300px;
          line-height: 1.5;
          margin: 0;
        }

        .placeholder-hint {
          font-size: 12px;
          color: #666;
          max-width: 320px;
          line-height: 1.4;
          margin-top: 8px;
          text-align: center;
        }

        /* Keyboard shortcuts support */
        @media (hover: hover) {
          .control-btn:hover::after {
            content: attr(title);
            position: absolute;
            bottom: -32px;
            left: 50%;
            transform: translateX(-50%);
            padding: 4px 8px;
            background: #1a1a1a;
            border: 1px solid #333;
            border-radius: 4px;
            font-size: 11px;
            white-space: nowrap;
            pointer-events: none;
            z-index: 1000;
          }
        }

        /* Responsive adjustments */
        @media (max-width: 768px) {
          .mode-btn span {
            display: none;
          }

          .viewer-info {
            display: none;
          }

          .zoom-level {
            min-width: 40px;
          }
        }
      `}</style>
    </div>
  )
}