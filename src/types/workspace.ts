/**
 * Workspace type definitions
 *
 * Data structure:
 * - Single meta.json file as version index
 * - File system as storage backend
 * - Timestamp as version ID
 */

export interface WorkspaceVersion {
  id: string // format: "20260310_143052"
  prompt: string
  codeFile: string // relative path: ".eai/versions/20260310_143052/code.tsx"
  timestamp: number
  isValid: boolean
  kicadFiles?: {
    pcb: string
    sch: string
  }
}

export interface WorkspaceMeta {
  name: string
  createdAt: number
  lastModified: number
  versions: WorkspaceVersion[]
  currentVersion: string | null
}

export interface CreateVersionOptions {
  code: string
  prompt: string
  timestamp: number
  isValid: boolean
  kicadFiles?: {
    pcb: string
    sch: string
  }
}

export interface SaveWorkspaceResultRequest {
  path: string
  code: string
  prompt: string
  timestamp?: number
  isValid?: boolean
  kicadFiles: {
    pcb: string
    sch: string
  }
}

export interface InitWorkspaceOptions {
  path: string
  name?: string
}

export interface UpdateVersionCodeRequest {
  path: string
  versionId: string
  code: string
  isValid: boolean
}
