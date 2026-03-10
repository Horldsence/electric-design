import type { AnyCircuitElement } from 'circuit-json'
import type React from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import useSocket from '../hooks/use-socket'
import type { PipelineStage } from '../lib/pipeline-progress'
import { LogViewer } from './LogViewer'
import { SchematicViewer } from './SchematicViewer'
import { WorkspaceSelector } from './WorkspaceSelector'

export function ConsoleInterface() {
  const { logs, status, clearLogs, onProgress } = useSocket()
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
  const [_kicadFiles, setKicadFiles] = useState<{ pcb: string; sch: string } | null>(null)
  const [abortController, setAbortController] = useState<AbortController | null>(null)
  type RequestStage =
    | 'idle'
    | 'requesting'
    | 'ai-processing'
    | 'compiling'
    | 'validating'
    | 'converting'
    | 'fixing'
    | 'rendering'
    | 'completed'
    | 'failed'

  const [requestStage, setRequestStageRaw] = useState<RequestStage>('idle')
  const requestStageRef = useRef<RequestStage>('idle')

  // The sessionId of the currently active pipeline request.
  // Only progress events matching this id are allowed to drive state.
  const sessionIdRef = useRef<string | null>(null)

  // Wrapper that keeps ref in sync with state, so async code and effects
  // always see the latest value without stale-closure issues.
  const setRequestStage = useCallback((stage: RequestStage) => {
    requestStageRef.current = stage
    setRequestStageRaw(stage)
  }, [])

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

  // ── Stage label lookup ──────────────────────────────────────────
  // A plain map from PipelineStage → display info.  No string matching,
  // no log scanning, no heuristics.  The stage value comes from a typed
  // WebSocket event or from an explicit setRequestStage() call.
  const stageDisplay: Record<
    RequestStage,
    { label: string; detail: string; tone: 'idle' | 'info' | 'warning' | 'error' | 'success' }
  > = {
    idle:          { label: '准备就绪',   detail: '输入需求后即可开始生成电路',         tone: 'idle' },
    requesting:    { label: '发送请求中', detail: '正在提交设计请求到后端',             tone: 'info' },
    'ai-processing': { label: 'AI 处理中', detail: '正在生成电路代码',                 tone: 'info' },
    compiling:     { label: '代码编译中', detail: '正在编译电路代码',                   tone: 'info' },
    validating:    { label: '检查中',     detail: '正在执行电路校验',                   tone: 'warning' },
    converting:    { label: '导出中',     detail: '正在转换为 KiCad 格式',              tone: 'info' },
    fixing:        { label: 'AI 修复中', detail: '检测到问题，正在尝试自动修复',        tone: 'warning' },
    rendering:     { label: '渲染中',     detail: '正在生成 PCB / 原理图预览',          tone: 'info' },
    completed:     { label: '渲染完成',   detail: '预览已准备就绪',                     tone: 'success' },
    failed:        { label: '检查到错误', detail: '流程中断，请查看错误信息',            tone: 'error' },
  }

  const progressState = useMemo(() => {
    if (error) {
      return { label: '处理失败', detail: error, tone: 'error' as const }
    }
    const entry = stageDisplay[requestStage]
    return { label: entry.label, detail: entry.detail, tone: entry.tone }
  }, [requestStage, error])

  // ── Subscribe to structured pipeline progress events ────────────
  // Only events whose sessionId matches our current request are accepted.
  // This replaces the old log-scanning useEffect entirely.
  useEffect(() => {
    const unsub = onProgress((event) => {
      console.debug('[onProgress] received', {
        eventSessionId: event.sessionId,
        stage: event.stage,
        detail: event.detail,
        activeSessionId: sessionIdRef.current,
        currentStage: requestStageRef.current,
      })

      // Ignore events from other sessions (e.g. a stale compilation)
      if (event.sessionId !== sessionIdRef.current) {
        console.debug('[onProgress] IGNORED — sessionId mismatch', {
          expected: sessionIdRef.current,
          got: event.sessionId,
        })
        return
      }

      // Never regress from terminal states — HTTP response owns those
      const cur = requestStageRef.current
      if (cur === 'completed' || cur === 'failed' || cur === 'idle') {
        console.debug('[onProgress] IGNORED — already in terminal state', { cur })
        return
      }

      // Map PipelineStage → RequestStage (they overlap by design)
      const mapped: Record<PipelineStage, RequestStage> = {
        compiling:  'compiling',
        validating: 'validating',
        converting: 'converting',
        rendering:  'rendering',
        completed:  'completed',
        failed:     'failed',
      }
      const next = mapped[event.stage]
      if (next) {
        console.debug('[onProgress] transitioning', { from: cur, to: next })
        setRequestStage(next)
      }
    })
    return unsub
  }, [onProgress, setRequestStage])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!prompt.trim()) return

    const sid = `compile_${Date.now()}`
    sessionIdRef.current = sid
    console.debug('[handleSubmit] start', { sid })

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
      console.debug('[handleSubmit] ai-processing', { sid })
      const genData = await genRes.json()
      if (!genData.success) throw new Error(genData.error?.message || 'Generation failed')

      const code = genData.data.code
      setGeneratedCode(code)
      const nextStage = workspace ? 'validating' : 'compiling'
      console.debug('[handleSubmit] code received, transitioning', { sid, nextStage })
      setRequestStage(nextStage)

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

        applyPipelineResult(exportData.data)
        setRequestStage('completed')
      } else {
        console.debug('[handleSubmit] fetching /api/compile-and-convert', { sid })
        const compileRes = await fetch('/api/compile-and-convert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, sessionId: sid }),
        })

        const compileData = await compileRes.json().catch(() => ({ error: 'Unknown error' }))
        console.debug('[handleSubmit] compile-and-convert response', {
          sid,
          ok: compileRes.ok,
          success: compileData.success,
          responseSessionId: compileData.sessionId,
        })

        if (!compileRes.ok || !compileData.success || !compileData.data) {
          throw new Error(compileData.error?.message || 'Compilation failed')
        }

        applyPipelineResult(compileData.data)
        console.debug('[handleSubmit] setting completed', { sid })
        setRequestStage('completed')
      }
    } catch (err) {
      console.debug('[handleSubmit] error', { sid, error: err instanceof Error ? err.message : err })
      setError(err instanceof Error ? err.message : 'An unknown error occurred')
    } finally {
      console.debug('[handleSubmit] finally', { sid, currentStage: requestStageRef.current })
      setIsProcessing(false)
      sessionIdRef.current = null
    }
  }

  const handleRenderSvg = async () => {
    if (!generatedCode) {
      alert('请先生成电路代码')
      return
    }

    const sid = `compile_${Date.now()}`
    sessionIdRef.current = sid
    console.debug('[handleRenderSvg] start', { sid })

    const controller = new AbortController()
    setAbortController(controller)
    setIsProcessing(true)
    setError(null)
    setRequestStage('compiling')

    try {
      console.debug('[handleRenderSvg] fetching /api/compile-and-convert', { sid })
      const compileRes = await fetch('/api/compile-and-convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: generatedCode, sessionId: sid }),
        signal: controller.signal,
      })

      const compileData = await compileRes.json().catch(() => ({ error: 'Unknown error' }))
      console.debug('[handleRenderSvg] compile-and-convert response', {
        sid,
        ok: compileRes.ok,
        success: compileData.success,
        responseSessionId: compileData.sessionId,
      })

      if (!compileRes.ok || !compileData.success || !compileData.data) {
        throw new Error(compileData.error?.message || 'Compilation failed')
      }

      console.debug('[handleRenderSvg] setting completed', { sid })
      setRequestStage('completed')
      setCircuitJson(compileData.data.circuitJson)
      setKicadFiles(compileData.data.kicadFiles ?? null)

      const pcbSvg = compileData.data.artifacts?.pcbSvg
      const schematicSvg = compileData.data.artifacts?.schematicSvg

      if (pcbSvg) {
        setPcbSvg(pcbSvg)
      }
      if (schematicSvg) {
        setSchematicSvg(schematicSvg)
      }

      setSuccessMessage('SVG渲染完成')
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setRequestStage('idle')
        setError(null)
        setSuccessMessage('已取消')
        setTimeout(() => setSuccessMessage(null), 2000)
      } else {
        setRequestStage('failed')
        setError(err instanceof Error ? err.message : '渲染失败')
        setSuccessMessage(null)
      }
    } finally {
      console.debug('[handleRenderSvg] finally', { sid, currentStage: requestStageRef.current })
      setIsProcessing(false)
      setAbortController(null)
      sessionIdRef.current = null
    }
  }

  const handleCancel = () => {
    if (abortController) {
      abortController.abort()
    }
  }

  const handleCompileCode = async () => {
    if (!generatedCode) {
      alert('请先生成电路代码')
      return
    }

    const sid = `compile_${Date.now()}`
    sessionIdRef.current = sid
    console.debug('[handleCompileCode] start', { sid })

    setIsProcessing(true)
    setError(null)
    setRequestStage('compiling')

    try {
      console.debug('[handleCompileCode] fetching /api/compile', { sid })
      const compileRes = await fetch('/api/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: generatedCode, sessionId: sid }),
      })

      const compileData = await compileRes.json().catch(() => ({ error: 'Unknown error' }))
      console.debug('[handleCompileCode] compile response', {
        sid,
        ok: compileRes.ok,
        success: compileData.success,
        responseSessionId: compileData.sessionId,
      })

      if (!compileRes.ok || !compileData.success) {
        throw new Error(compileData.error?.message || 'Compilation failed')
      }

      console.debug('[handleCompileCode] setting completed', { sid })
      setRequestStage('completed')
      setSuccessMessage(`编译成功: ${compileData.data?.circuitJson?.length || 0} 个元素`)
    } catch (err) {
      console.debug('[handleCompileCode] error', { sid, error: err instanceof Error ? err.message : err })
      setRequestStage('failed')
      setError(err instanceof Error ? err.message : '编译失败')
      setSuccessMessage(null)
    } finally {
      console.debug('[handleCompileCode] finally', { sid, currentStage: requestStageRef.current })
      setIsProcessing(false)
      sessionIdRef.current = null
    }
  }

  const handleOpenFolder = async () => {
    if (!workspace) {
      alert('请先选择工作空间')
      return
    }

    try {
      const res = await fetch('/api/open-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: workspace }),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error?.message || 'Failed to open folder')
      }

      const data = await res.json()
      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to open folder')
      }
    } catch (err) {
      console.error(err)
      alert(`打开文件夹失败: ${err instanceof Error ? err.message : '未知错误'}`)
    }
  }

  const handleVersionSelect = async (versionId: string) => {
    if (!workspace) return

    setCurrentVersionId(versionId)
    setError(null)
    setPcbSvg(null)
    setSchematicSvg(null)

    try {
      const res = await fetch(
        `/api/workspace?path=${encodeURIComponent(workspace)}&versionId=${versionId}`,
      )
      const data = await res.json().catch(() => ({ error: 'Unknown error' }))

      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to load version')
      }

      const { code, artifacts } = data.data
      setGeneratedCode(code)

      if (artifacts && (artifacts.pcbSvg || artifacts.schematicSvg)) {
        setPcbSvg(artifacts.pcbSvg || null)
        setSchematicSvg(artifacts.schematicSvg || null)
        setRequestStage('completed')
        setSuccessMessage(`已加载版本: ${versionId} (使用缓存)`)
      } else {
        setRequestStage('idle')
        setSuccessMessage(`已加载版本: ${versionId} (无缓存，点击"渲染SVG"生成预览)`)
        setTimeout(() => setSuccessMessage(null), 5000)
      }
    } catch (err) {
      setRequestStage('failed')
      setError(err instanceof Error ? err.message : '加载版本失败')
      setSuccessMessage(null)
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
            <div className="button-group">
              <button
                type="submit"
                disabled={isProcessing || !prompt.trim()}
                className="submit-btn"
              >
                {isProcessing ? '处理中...' : '生成电路'}
              </button>
              {isProcessing && (
                <button type="button" className="submit-btn danger" onClick={handleCancel}>
                  中断
                </button>
              )}
            </div>
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
              <button type="button" className="inline-notice-close" onClick={() => setError(null)}>
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
              <div className="section-title">操作</div>
              <div className="button-group">
                <button
                  type="button"
                  onClick={handleRenderSvg}
                  className="action-btn"
                  disabled={isProcessing}
                >
                  渲染 SVG
                </button>
                <button
                  type="button"
                  onClick={handleCompileCode}
                  className="action-btn secondary"
                  disabled={isProcessing}
                >
                  编译代码
                </button>
                <button
                  type="button"
                  onClick={handleOpenFolder}
                  className="action-btn secondary"
                  disabled={!workspace}
                >
                  打开项目文件夹
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

        .submit-btn.danger {
          background: #f44336;
          color: #fff;
        }

        .submit-btn.danger:hover:not(:disabled) {
          background: #d32f2f;
        }

        .button-group {
          display: flex;
          gap: 10px;
        }

        .button-group .submit-btn {
          flex: 1;
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
