import type { AnyCircuitElement } from 'circuit-json'
import type React from 'react'
import { useState } from 'react'
import useSocket from '../hooks/use-socket'
import { LogViewer } from './LogViewer'
import { SchematicViewer } from './SchematicViewer'

export function ConsoleInterface() {
  const { logs, status, clearLogs } = useSocket()
  const [prompt, setPrompt] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [generatedCode, setGeneratedCode] = useState<string | null>(null)
  const [circuitJson, setCircuitJson] = useState<AnyCircuitElement[] | null>(null)
  const [pcbSvg, setPcbSvg] = useState<string | null>(null)
  const [schematicSvg, setSchematicSvg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!prompt.trim()) return

    setIsProcessing(true)
    setError(null)
    setGeneratedCode(null)
    setCircuitJson(null)
    setPcbSvg(null)
    setSchematicSvg(null)

    try {
      // 1. Generate Code
      const genRes = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      })

      if (!genRes.ok) throw new Error('Generation failed')

      const genData = await genRes.json()
      if (!genData.success) throw new Error(genData.error?.message || 'Generation failed')

      const code = genData.data.code
      setGeneratedCode(code)

      // 2. Compile for Preview (SVG)
      // Note: Assuming /api/compile returns SVG in the response for preview
      const compileRes = await fetch('/api/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })

      if (compileRes.ok) {
        const compileData = await compileRes.json()
        if (compileData.success && compileData.data) {
          // Save circuitJson for later use in downloads
          setCircuitJson(compileData.data.circuitJson)

          // Set both PCB and schematic SVGs
          if (compileData.data.pcbSvg) {
            setPcbSvg(compileData.data.pcbSvg)
          }
          if (compileData.data.schematicSvg) {
            setSchematicSvg(compileData.data.schematicSvg)
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDownload = async (type: 'kicad' | 'gerber' | 'bom') => {
    if (!circuitJson) {
      alert('请先生成电路')
      return
    }

    try {
      let endpoint = ''

      switch (type) {
        case 'kicad':
          endpoint = '/api/download-kicad'
          break
        case 'gerber':
          endpoint = '/api/download-gerbers'
          break
        case 'bom':
          endpoint = '/api/download-bom'
          break
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ circuitJson }),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || errorData.message || `Failed to download ${type}`)
      }

      // Get the filename from Content-Disposition header or use default
      const contentDisposition = res.headers.get('Content-Disposition')
      let filename = `design_${type}.txt`

      if (contentDisposition) {
        const matches = /filename="([^"]+)"/.exec(contentDisposition)
        if (matches?.[1]) {
          filename = matches[1]
        }
      }

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      console.error(err)
      alert(`下载失败 ${type}: ${err instanceof Error ? err.message : '未知错误'}`)
    }
  }

  return (
    <div className="console-interface">
      <header className="console-header">
        <div className="status-indicator">
          <span className={`status-dot ${status}`} />
          <span className="status-text">
            {status === 'connected' ? '已连接' : status === 'connecting' ? '连接中' : '未连接'}
          </span>
        </div>
        <h2>AI 电路设计器</h2>
      </header>

      <div className="main-layout">
        <div className="left-panel">
          <form onSubmit={handleSubmit} className="prompt-form">
            <div className="input-group">
              <label htmlFor="prompt">描述您的电路需求：</label>
              <textarea
                id="prompt"
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                placeholder="例如：一个由9V电池供电的555定时器电路，以1Hz频率闪烁LED..."
                disabled={isProcessing}
                className="prompt-input"
              />
            </div>
            <button type="submit" disabled={isProcessing || !prompt.trim()} className="submit-btn">
              {isProcessing ? '处理中...' : '生成电路'}
            </button>
          </form>

          <div className="logs-section">
            <div className="section-title">系统日志</div>
            <LogViewer logs={logs} className="log-viewer-component" onClear={clearLogs} />
          </div>
        </div>

        <div className="right-panel">
          <div className="preview-section">
            <div className="section-title">
              电路预览
              {(pcbSvg || schematicSvg) && (
                <span className="preview-status">
                  {pcbSvg && schematicSvg && ' • PCB + 原理图'}
                  {pcbSvg && !schematicSvg && ' • 仅PCB'}
                  {!pcbSvg && schematicSvg && ' • 仅原理图'}
                </span>
              )}
            </div>
            {error ? (
              <div className="error-message-box">
                <svg
                  width="48"
                  height="48"
                  viewBox="0 0 48 48"
                  fill="none"
                  style={{ marginBottom: '12px' }}
                >
                  <title>错误提示</title>
                  <circle cx="24" cy="24" r="20" stroke="#f48771" strokeWidth="2" fill="none" />
                  <path
                    d="M24 16v12M24 32v2"
                    stroke="#f48771"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                </svg>
                <div>{error}</div>
                <button
                  type="button"
                  onClick={() => setError(null)}
                  className="error-dismiss-btn"
                  style={{ marginTop: '12px' }}
                >
                  关闭
                </button>
              </div>
            ) : isProcessing ? (
              <div className="processing-message">
                <div className="spinner" />
                <p>正在生成电路设计...</p>
                <p className="processing-hint">正在编译代码并生成预览图</p>
              </div>
            ) : (
              <SchematicViewer
                pcbSvg={pcbSvg}
                schematicSvg={schematicSvg}
                className="schematic-viewer-component"
              />
            )}
          </div>

          {generatedCode && (
            <div className="actions-section">
              <div className="section-title">导出文件</div>
              <div className="button-group">
                <button
                  type="button"
                  onClick={() => handleDownload('kicad')}
                  className="action-btn"
                >
                  下载 KiCad PCB
                </button>
                <button
                  type="button"
                  onClick={() => handleDownload('gerber')}
                  className="action-btn secondary"
                >
                  下载 Gerber 文件
                </button>
                <button
                  type="button"
                  onClick={() => handleDownload('bom')}
                  className="action-btn secondary"
                >
                  下载物料清单
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .console-interface {
          width: 100%;
          max-width: 1400px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 20px;
          text-align: left;
          font-family: 'Inter', system-ui, sans-serif;
        }

        .console-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid #333;
          padding-bottom: 10px;
        }

        .status-indicator {
          display: flex;
          align-items: center;
          gap: 8px;
          font-family: monospace;
          font-size: 12px;
          background: #1a1a1a;
          padding: 4px 8px;
          border-radius: 4px;
        }

        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background-color: #666;
        }

        .status-dot.connected { background-color: #4caf50; box-shadow: 0 0 5px #4caf50; }
        .status-dot.connecting { background-color: #ff9800; }
        .status-dot.disconnected { background-color: #f44336; }

        .main-layout {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          height: calc(100vh - 150px);
        }

        @media (max-width: 900px) {
            .main-layout {
                grid-template-columns: 1fr;
                height: auto;
            }
        }

        .left-panel, .right-panel {
          display: flex;
          flex-direction: column;
          gap: 20px;
          height: 100%;
          min-height: 0;
          min-width: 0;
        }

        .prompt-form {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .input-group label {
          display: block;
          font-size: 0.85rem;
          color: #888;
          margin-bottom: 8px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .prompt-input {
          width: 100%;
          height: 120px;
          background: #111;
          border: 1px solid #333;
          border-radius: 6px;
          color: #eee;
          padding: 12px;
          font-family: inherit;
          font-size: 1rem;
          resize: none;
          outline: none;
          transition: border-color 0.2s;
          box-sizing: border-box;
        }

        .prompt-input:focus {
          border-color: #666;
        }

        .submit-btn {
          background: #fbf0df;
          color: #222;
          border: none;
          padding: 12px;
          font-weight: 700;
          border-radius: 6px;
          cursor: pointer;
          transition: opacity 0.2s, transform 0.1s;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .submit-btn:hover:not(:disabled) {
          opacity: 0.9;
          transform: translateY(-1px);
        }

        .submit-btn:disabled {
          background: #444;
          color: #888;
          cursor: not-allowed;
        }

        .logs-section {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-height: 0;
        }

        .section-title {
          font-size: 0.75rem;
          color: #666;
          margin-bottom: 8px;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .preview-status {
          font-size: 0.7rem;
          color: #4caf50;
          text-transform: none;
          font-weight: 500;
          letter-spacing: normal;
        }

        .log-viewer-component {
            flex: 1;
            height: 100%;
            border-radius: 6px;
            font-size: 13px;
        }

        .preview-section {
            flex: 1;
            display: flex;
            flex-direction: column;
            min-height: 0;
            min-width: 0;
            gap: 12px;
        }

        .schematic-viewer-component {
            flex: 1;
            min-height: 0;
            min-width: 0;
        }

        .error-message-box {
            background: #111;
            border: 1px solid #f48771;
            border-radius: 6px;
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            color: #f48771;
            padding: 40px 20px;
            text-align: center;
            max-width: 80%;
            margin: auto;
        }

        .error-dismiss-btn {
            background: transparent;
            border: 1px solid #f48771;
            color: #f48771;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            transition: all 0.2s;
        }

        .error-dismiss-btn:hover {
            background: #f48771;
            color: #111;
        }

        .processing-message {
            background: #111;
            border: 1px solid #333;
            border-radius: 6px;
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 12px;
            color: #888;
        }

        .processing-hint {
            font-size: 12px;
            color: #666;
            margin: 0;
        }

        .spinner {
            width: 40px;
            height: 40px;
            border: 3px solid #222;
            border-top-color: #fbf0df;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }

        @keyframes spin {
            to { transform: rotate(360deg); }
        }

        .actions-section {
            margin-top: auto;
        }

        .button-group {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
        }

        .action-btn {
            background: #2b2b2b;
            border: 1px solid #444;
            color: #eee;
            padding: 10px 16px;
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.2s;
            font-size: 0.9rem;
            flex: 1;
        }

        .action-btn:hover {
            background: #333;
            border-color: #666;
        }

        .action-btn.secondary {
            background: transparent;
            border-style: dashed;
        }
      `}</style>
    </div>
  )
}
