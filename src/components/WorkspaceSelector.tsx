import { useState } from 'react'
import type { WorkspaceMeta } from '../types/workspace'

interface WorkspaceSelectorProps {
  onWorkspaceSelect: (workspacePath: string | null) => void
  currentWorkspace: string | null
}

export function WorkspaceSelector({ onWorkspaceSelect, currentWorkspace }: WorkspaceSelectorProps) {
  const [workspacePath, setWorkspacePath] = useState(currentWorkspace || '')
  const [meta, setMeta] = useState<WorkspaceMeta | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLoadWorkspace = async () => {
    if (!workspacePath.trim()) {
      setError('请输入工作空间路径')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/workspace?path=${encodeURIComponent(workspacePath)}`)

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error?.message || 'Failed to load workspace')
      }

      const data = await res.json()

      if (data.success) {
        setMeta(data.data)
        onWorkspaceSelect(workspacePath)
      } else {
        throw new Error(data.error?.message || 'Failed to load workspace')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误')
      setMeta(null)
    } finally {
      setLoading(false)
    }
  }

  const handleInitWorkspace = async () => {
    if (!workspacePath.trim()) {
      setError('请输入工作空间路径')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: workspacePath }),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error?.message || 'Failed to initialize workspace')
      }

      const data = await res.json()

      if (data.success) {
        setMeta(data.data)
        onWorkspaceSelect(workspacePath)
      } else {
        throw new Error(data.error?.message || 'Failed to initialize workspace')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误')
      setMeta(null)
    } finally {
      setLoading(false)
    }
  }

  const handleClearWorkspace = () => {
    setWorkspacePath('')
    setMeta(null)
    onWorkspaceSelect(null)
    setError(null)
  }

  return (
    <div className="workspace-selector">
      <div className="workspace-header">
        <h3>工作空间</h3>
      </div>

      <div className="workspace-input-group">
        <input
          type="text"
          className="workspace-input"
          placeholder="/path/to/workspace"
          value={workspacePath}
          onChange={e => setWorkspacePath(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              handleLoadWorkspace()
            }
          }}
        />
        <div className="workspace-actions">
          <button
            type="button"
            className="workspace-btn primary"
            onClick={handleLoadWorkspace}
            disabled={loading}
          >
            {loading ? '加载中...' : '加载'}
          </button>
          <button
            type="button"
            className="workspace-btn secondary"
            onClick={handleInitWorkspace}
            disabled={loading}
          >
            新建
          </button>
          {currentWorkspace && (
            <button
              type="button"
              className="workspace-btn danger"
              onClick={handleClearWorkspace}
              disabled={loading}
            >
              清除
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="workspace-error">
          <span>{error}</span>
        </div>
      )}

      {meta && (
        <div className="workspace-info">
          <div className="workspace-info-item">
            <span className="label">名称:</span>
            <span className="value">{meta.name}</span>
          </div>
          <div className="workspace-info-item">
            <span className="label">版本数:</span>
            <span className="value">{meta.versions.length}</span>
          </div>
          {meta.currentVersion && (
            <div className="workspace-info-item">
              <span className="label">当前版本:</span>
              <span className="value">{meta.currentVersion}</span>
            </div>
          )}
        </div>
      )}

      <style>{`
        .workspace-selector {
          background: #1a1a1a;
          border: 1px solid #333;
          border-radius: 6px;
          padding: 16px;
          margin-bottom: 20px;
        }

        .workspace-header h3 {
          margin: 0 0 12px 0;
          font-size: 0.85rem;
          color: #888;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .workspace-input-group {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .workspace-input {
          width: 100%;
          background: #111;
          border: 1px solid #333;
          border-radius: 4px;
          color: #eee;
          padding: 10px 12px;
          font-family: 'Monaco', 'Menlo', monospace;
          font-size: 0.9rem;
          outline: none;
          box-sizing: border-box;
        }

        .workspace-input:focus {
          border-color: #666;
        }

        .workspace-actions {
          display: flex;
          gap: 8px;
        }

        .workspace-btn {
          flex: 1;
          padding: 8px 12px;
          border: none;
          border-radius: 4px;
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          transition: opacity 0.2s;
        }

        .workspace-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .workspace-btn.primary {
          background: #fbf0df;
          color: #222;
        }

        .workspace-btn.secondary {
          background: transparent;
          border: 1px dashed #666;
          color: #888;
        }

        .workspace-btn.secondary:hover:not(:disabled) {
          border-color: #888;
          color: #aaa;
        }

        .workspace-btn.danger {
          background: transparent;
          border: 1px solid #f44336;
          color: #f44336;
        }

        .workspace-btn.danger:hover:not(:disabled) {
          background: #f44336;
          color: #fff;
        }

        .workspace-error {
          margin-top: 10px;
          padding: 10px;
          background: rgba(244, 67, 54, 0.1);
          border: 1px solid #f44336;
          border-radius: 4px;
          color: #f44336;
          font-size: 0.85rem;
        }

        .workspace-info {
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid #333;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .workspace-info-item {
          display: flex;
          justify-content: space-between;
          font-size: 0.8rem;
        }

        .workspace-info-item .label {
          color: #666;
        }

        .workspace-info-item .value {
          color: #eee;
          font-family: 'Monaco', 'Menlo', monospace;
        }
      `}</style>
    </div>
  )
}
