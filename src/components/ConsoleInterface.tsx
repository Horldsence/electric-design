import type { AnyCircuitElement } from 'circuit-json'
import type React from 'react'
import { useEffect, useMemo, useState } from 'react'
import useSocket from '../hooks/use-socket'
import { LogViewer } from './LogViewer'
import { SchematicViewer } from './SchematicViewer'
import { WorkspaceSelector } from './WorkspaceSelector'

export function ConsoleInterface() {
  const { logs, status, clearLogs } = useSocket()
  const [workspace, setWorkspace] = useState<string | null>('./projects/default-workspace')
  const [currentVersionId, setCurrentVersionId] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [prompt, setPrompt] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [generatedCode, setGeneratedCode] = useState<string | null>(null)
  const [circuitJson, setCircuitJson] = useState<AnyCircuitElement[] | null>(null)
  const [pcbSvg, setPcbSvg] = useState<string | null>(null)
  const [schematicSvg, setSchematicSvg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [kicadFiles, setKicadFiles] = useState<{ pcb: string; sch: string } | null>(null)
  const [requestStage, setRequestStage] = useState<
    | 'idle'
    | 'requesting'
    | 'ai-processing'
    | 'compiling'
    | 'validating'
    | 'fixing'
    | 'rendering'
    | 'completed'
    | 'failed'
  >('idle')

  const applyPipelineResult = (data: {
    circuitJson?: AnyCircuitElement[]
    pcbSvg?: string
    schematicSvg?: string
    kicadFiles?: {
      pcb: string
      sch: string
    }
    artifacts?: {
      pcbSvg?: string
      schematicSvg?: string
    }
  }) => {
    if (data.circuitJson) {
      setCircuitJson(data.circuitJson)
    }

    if (data.kicadFiles?.pcb && data.kicadFiles?.sch) {
      setKicadFiles(data.kicadFiles)
    }

    const nextPcbSvg = data.pcbSvg ?? data.artifacts?.pcbSvg
    const nextSchematicSvg = data.schematicSvg ?? data.artifacts?.schematicSvg

    if (nextPcbSvg) {
      setPcbSvg(nextPcbSvg)
    }

    if (nextSchematicSvg) {
      setSchematicSvg(nextSchematicSvg)
    }
  }

  const progressState = useMemo(() => {
    const recentLogs = logs.slice(-20)

    if (error) {
      return {
        label: '处理失败',
        detail: error,
        tone: 'error' as const,
      }
    }

    for (let i = recentLogs.length - 1; i >= 0; i--) {
      const log = recentLogs[i]
      if (!log) continue
      const context = log.context.toLowerCase()
      const message = log.message.toLowerCase()

      if (log.level === 'error') {
        return {
          label: '检查到错误',
          detail: `${log.context}：${log.message}`,
          tone: 'error' as const,
        }
      }

      if (context.includes('autofix') || message.includes('auto-fix')) {
        return {
          label: 'AI 修复中',
          detail: `${log.context}：${log.message}`,
          tone: 'warning' as const,
        }
      }

      if (context.includes('validation') || context.includes('erc') || context.includes('drc')) {
        return {
          label: '检查中',
          detail: `${log.context}：${log.message}`,
          tone: 'warning' as const,
        }
      }

      if (context.includes('compile') || message.includes('compilation')) {
        return {
          label: '代码编译中',
          detail: `${log.context}：${log.message}`,
          tone: 'info' as const,
        }
      }

      if (
        context.includes('ai-generation') ||
        context.includes('llm') ||
        message.includes('calling llm') ||
        message.includes('llm response received')
      ) {
        return {
          label: 'AI 处理中',
          detail: `${log.context}：${log.message}`,
          tone: 'info' as const,
        }
      }

      if (context.includes('postprocess') || message.includes('schematic svg') || message.includes('render')) {
        return {
          label: '渲染中',
          detail: `${log.context}：${log.message}`,
          tone: 'info' as const,
        }
      }
    }

    switch (requestStage) {
      case 'requesting':
        return {
          label: '发送请求中',
          detail: '正在提交设计请求到后端',
          tone: 'info' as const,
        }
      case 'ai-processing':
        return {
          label: 'AI 处理中',
          detail: '正在生成电路代码',
          tone: 'info' as const,
        }
      case 'compiling':
        return {
          label: '代码编译中',
          detail: '正在编译并分析电路代码',
          tone: 'info' as const,
        }
      case 'validating':
        return {
          label: '检查中',
          detail: '正在执行电路校验与导出检查',
          tone: 'warning' as const,
        }
      case 'fixing':
        return {
          label: 'AI 修复中',
          detail: '检测到问题，正在尝试自动修复',
          tone: 'warning' as const,
        }
      case 'rendering':
        return {
          label: '渲染中',
          detail: '正在生成 PCB / 原理图预览',
          tone: 'info' as const,
        }
      case 'completed':
        return {
          label: '渲染完成',
          detail: '预览已准备就绪',
          tone: 'success' as const,
        }
      case 'failed':
        return {
          label: '检查到错误',
          detail: '流程中断，请查看错误信息',
          tone: 'error' as const,
        }
      default:
        return {
          label: '准备就绪',
          detail: '输入需求后即可开始生成电路',
          tone: 'idle' as const,
        }
    }
  }, [logs, requestStage, error])

  useEffect(() => {
    if (isProcessing && (pcbSvg || schematicSvg)) {
      setRequestStage('rendering')
    }
  }, [isProcessing, pcbSvg, schematicSvg])

  useEffect(() => {
    if (!isProcessing && !error && (pcbSvg || schematicSvg)) {
      setRequestStage('completed')
    }
  }, [isProcessing, error, pcbSvg, schematicSvg])

  useEffect(() => {
    if (error) {
      setRequestStage('failed')
      return
    }

    const lastLog = logs[logs.length - 1]
    if (!isProcessing || !lastLog) return

    const context = lastLog.context.toLowerCase()
    const message = lastLog.message.toLowerCase()

    if (lastLog.level === 'error') {
      setRequestStage('failed')
      return
    }

    if (context.includes('autofix') || message.includes('auto-fix')) {
      setRequestStage('fixing')
      return
    }

    if (context.includes('validation') || context.includes('erc') || context.includes('drc')) {
      setRequestStage('validating')
      return
    }

    if (context.includes('compile') || message.includes('compilation')) {
      setRequestStage('compiling')
      return
    }

    if (
      context.includes('ai-generation') ||
      context.includes('llm') ||
      message.includes('calling llm') ||
      message.includes('llm response received')
    ) {
      setRequestStage('ai-processing')
      return
    }

    if (context.includes('postprocess') || message.includes('schematic svg') || message.includes('render')) {
      setRequestStage('rendering')
    }
  }, [logs, isProcessing, error])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!prompt.trim()) return

    setIsProcessing(true)
    setError(null)
    setSuccessMessage(null)
    setGeneratedCode(null)
    setCircuitJson(null)
    setPcbSvg(null)
    setSchematicSvg(null)
    setKicadFiles(null)
    setRequestStage('requesting')

    try {
      const genRes = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      })

      if (!genRes.ok) throw new Error('Generation failed')

      setRequestStage('ai-processing')
      const genData = await genRes.json()
      if (!genData.success) throw new Error(genData.error?.message || 'Generation failed')

      const code = genData.data.code
      setGeneratedCode(code)
      setRequestStage(workspace ? 'validating' : 'compiling')

      if (workspace) {
        const exportRes = await fetch('/api/export', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt,
            options: { workspace, versionId: currentVersionId || undefined },
          }),
        })

        const exportData = await exportRes.json().catch(() => ({ error: 'Unknown error' }))

        if (!exportRes.ok || !exportData.success || !exportData.data) {
          throw new Error(exportData.error?.message || 'Export failed')
        }

        if (exportData.versionId) {
          setCurrentVersionId(exportData.versionId)
          setRefreshKey(prev => prev + 1)
        }

        setRequestStage('rendering')
        applyPipelineResult(exportData.data)
      } else {
        const compileRes = await fetch('/api/compile-and-convert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        })

        const compileData = await compileRes.json().catch(() => ({ error: 'Unknown error' }))

        if (!compileRes.ok || !compileData.success || !compileData.data) {
          throw new Error(compileData.error?.message || 'Compilation failed')
        }

        setRequestStage('rendering')
        setCircuitJson(compileData.data.circuitJson)
        setKicadFiles(compileData.data.kicadFiles ?? null)

        if (compileData.data.pcbSvg) {
          setPcbSvg(compileData.data.pcbSvg)
        }
        if (compileData.data.schematicSvg) {
          setSchematicSvg(compileData.data.schematicSvg)
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

  const handleVersionSelect = async (versionId: string) => {
    if (!workspace) return

    setCurrentVersionId(versionId)
    setIsProcessing(true)
    setError(null)
    setSuccessMessage(`加载版本: ${versionId}...`)

    try {
      const res = await fetch(`/api/workspace?path=${encodeURIComponent(workspace)}&versionId=${versionId}`)
      const data = await res.json().catch(() => ({ error: 'Unknown error' }))

      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to load version')
      }

      const { code } = data.data
      setGeneratedCode(code)

      const compileRes = await fetch('/api/compile-and-convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })

      const compileData = await compileRes.json().catch(() => ({ error: 'Unknown error' }))

      if (!compileRes.ok || !compileData.success || !compileData.data) {
        throw new Error(compileData.error?.message || 'Compilation failed')
      }

      setRequestStage('completed')
      setCircuitJson(compileData.data.circuitJson)
      setKicadFiles(compileData.data.kicadFiles ?? null)

      if (compileData.data.pcbSvg) {
        setPcbSvg(compileData.data.pcbSvg)
      }
      if (compileData.data.schematicSvg) {
        setSchematicSvg(compileData.data.schematicSvg)
      }
      setSuccessMessage(`已加载版本: ${versionId}`)
    } catch (err) {
      setRequestStage('failed')
      setError(err instanceof Error ? err.message : '加载版本失败')
      setSuccessMessage(null)
    } finally {
      setIsProcessing(false)
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

      <WorkspaceSelector 
        onWorkspaceSelect={setWorkspace} 
        currentWorkspace={workspace} 
        onVersionSelect={handleVersionSelect}
        onNewVersion={() => {
          setCurrentVersionId(null)
          setSuccessMessage('已新建版本，下次生成将保存为新版本')
        }}
        refreshKey={refreshKey}
        activeVersionId={currentVersionId}
      />

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

          {successMessage && (
            <div className="inline-notice success">
              <span>{successMessage}</span>
              <button
                type="button"
                className="inline-notice-close"
                onClick={() => setSuccessMessage(null)}
              >
                关闭
              </button>
            </div>
          )}

          {error && !isProcessing && (
            <div className="inline-notice error">
              <span>{error}</span>
              <button
                type="button"
                className="inline-notice-close"
                onClick={() => setError(null)}
              >
                关闭
              </button>
            </div>
          )}

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
            <div className={`preview-progress preview-progress-${progressState.tone}`}>
              <div className="preview-progress-label">{progressState.label}</div>
              <div className="preview-progress-detail">{progressState.detail}</div>
            </div>
            {isProcessing ? (
              <div className="processing-message">
                <div className="spinner" />
                <p>{progressState.label}</p>
                <p className="processing-hint">{progressState.detail}</p>
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

        .preview-progress {
          border: 1px solid #333;
          background: #141414;
          border-radius: 6px;
          padding: 10px 12px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .preview-progress-label {
          font-size: 0.8rem;
          font-weight: 700;
          color: #f5f5f5;
        }

        .preview-progress-detail {
          font-size: 0.78rem;
          color: #9a9a9a;
          line-height: 1.4;
        }

        .preview-progress-info {
          border-color: #3b4f68;
          background: rgba(59, 79, 104, 0.18);
        }

        .preview-progress-warning {
          border-color: #7a5b1f;
          background: rgba(122, 91, 31, 0.18);
        }

        .preview-progress-error {
          border-color: #7a2f2f;
          background: rgba(122, 47, 47, 0.2);
        }

        .preview-progress-success {
          border-color: #2f6a3d;
          background: rgba(47, 106, 61, 0.18);
        }

        .preview-progress-idle {
          border-color: #333;
          background: #141414;
        }

        .inline-notice {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          border-radius: 6px;
          padding: 10px 12px;
          font-size: 0.9rem;
        }

        .inline-notice.success {
          border: 1px solid #2f6a3d;
          background: rgba(47, 106, 61, 0.18);
          color: #b9f3c6;
        }

        .inline-notice.error {
          border: 1px solid #7a2f2f;
          background: rgba(122, 47, 47, 0.2);
          color: #f7b0b0;
        }

        .inline-notice-close {
          background: transparent;
          border: 1px solid currentColor;
          color: inherit;
          padding: 4px 10px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
          flex-shrink: 0;
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
