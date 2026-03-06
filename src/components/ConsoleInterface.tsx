import React, { useState, useEffect, useRef } from 'react'
import useSocket from '../hooks/use-socket'
import { LogViewer } from './LogViewer'

export function ConsoleInterface() {
  const { logs, status } = useSocket()
  const [prompt, setPrompt] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [generatedCode, setGeneratedCode] = useState<string | null>(null)
  const [circuitJson, setCircuitJson] = useState<any[] | null>(null)
  const [svgPreview, setSvgPreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [downloadUrls, setDownloadUrls] = useState<{ kicad?: string; gerber?: string; bom?: string }>({})

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!prompt.trim()) return

    setIsProcessing(true)
    setError(null)
    setGeneratedCode(null)
    setCircuitJson(null)
    setSvgPreview(null)
    setDownloadUrls({})

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
          
          if (compileData.data.svg) {
            setSvgPreview(compileData.data.svg)
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
      alert('Please generate a circuit first')
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
        if (matches && matches[1]) {
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
      alert(`Failed to download ${type}: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  return (
    <div className="console-interface">
      <header className="console-header">
        <div className="status-indicator">
          <span className={`status-dot ${status}`} />
          <span className="status-text">{status.toUpperCase()}</span>
        </div>
        <h2>AI Circuit Designer</h2>
      </header>

      <div className="main-layout">
        <div className="left-panel">
          <form onSubmit={handleSubmit} className="prompt-form">
            <div className="input-group">
              <label htmlFor="prompt">Describe your circuit requirement:</label>
              <textarea
                id="prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g. A 555 timer circuit blinking an LED at 1Hz powered by 9V battery..."
                disabled={isProcessing}
                className="prompt-input"
              />
            </div>
            <button type="submit" disabled={isProcessing || !prompt.trim()} className="submit-btn">
              {isProcessing ? 'PROCESSING...' : 'GENERATE CIRCUIT'}
            </button>
          </form>

          <div className="logs-section">
            <div className="section-title">SYSTEM LOGS</div>
            <LogViewer logs={logs} className="log-viewer-component" />
          </div>
        </div>

        <div className="right-panel">
          <div className="preview-section">
            <div className="section-title">CIRCUIT PREVIEW</div>
            <div className="preview-container">
              {error ? (
                <div className="error-message">{error}</div>
              ) : svgPreview ? (
                <div className="svg-wrapper" dangerouslySetInnerHTML={{ __html: svgPreview }} />
              ) : (
                <div className="placeholder-text">
                  {isProcessing ? 'Generating circuit design...' : 'Ready to generate.'}
                </div>
              )}
            </div>
          </div>

          {generatedCode && (
            <div className="actions-section">
                <div className="section-title">EXPORTS</div>
                <div className="button-group">
                    <button onClick={() => handleDownload('kicad')} className="action-btn">
                        Download KiCad PCB
                    </button>
                    <button onClick={() => handleDownload('gerber')} className="action-btn secondary">
                        Download Gerbers
                    </button>
                    <button onClick={() => handleDownload('bom')} className="action-btn secondary">
                        Download BOM
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
          min-height: 300px;
        }

        .section-title {
          font-size: 0.75rem;
          color: #666;
          margin-bottom: 8px;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          font-weight: 600;
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
            min-height: 400px;
        }

        .preview-container {
            background: #111;
            border: 1px solid #333;
            border-radius: 6px;
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
            position: relative;
        }

        .svg-wrapper {
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            box-sizing: border-box;
        }
        
        .svg-wrapper svg {
            max-width: 100%;
            max-height: 100%;
            width: auto;
            height: auto;
        }

        .placeholder-text {
            color: #444;
            font-style: italic;
        }

        .error-message {
            color: #f48771;
            padding: 20px;
            background: rgba(244, 135, 113, 0.1);
            border-radius: 6px;
            max-width: 80%;
            text-align: center;
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