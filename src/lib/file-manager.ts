import { mkdir, readFile, readdir, stat, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type {
  CreateVersionOptions,
  InitWorkspaceOptions,
  SaveWorkspaceResultRequest,
  WorkspaceMeta,
  WorkspaceVersion,
} from '../types/workspace'
import { logger } from './logger'

export class FileManager {
  private workspacePath: string
  private metaPath: string
  private versionsDir: string

  constructor(workspacePath: string) {
    this.workspacePath = workspacePath
    this.metaPath = join(workspacePath, '.eai', 'meta.json')
    this.versionsDir = join(workspacePath, '.eai', 'versions')
  }

  async init(options: InitWorkspaceOptions): Promise<WorkspaceMeta> {
    const { name } = options

    await mkdir(join(this.workspacePath, '.eai', 'versions'), { recursive: true })

    const pathParts = this.workspacePath.split('/').filter(Boolean)
    const lastPart = pathParts.length > 0 ? pathParts[pathParts.length - 1] : undefined
    const nameFromPath = lastPart ?? 'untitled'

    const meta: WorkspaceMeta = {
      name: name || nameFromPath,
      createdAt: Date.now(),
      lastModified: Date.now(),
      versions: [],
      currentVersion: null,
    }

    await writeFile(this.metaPath, JSON.stringify(meta, null, 2), 'utf-8')
    logger.info('workspace-init', `Workspace initialized at ${this.workspacePath}`)

    return meta
  }

  async getMeta(): Promise<WorkspaceMeta | null> {
    try {
      const content = await readFile(this.metaPath, 'utf-8')
      return JSON.parse(content) as WorkspaceMeta
    } catch {
      return null
    }
  }

  async updateMeta(updater: (meta: WorkspaceMeta) => WorkspaceMeta): Promise<WorkspaceMeta> {
    const meta = await this.getMeta()
    if (!meta) {
      throw new Error('Workspace not initialized')
    }

    const updated = updater(meta)
    await writeFile(this.metaPath, JSON.stringify(updated, null, 2), 'utf-8')
    return updated
  }

  async createVersion(options: CreateVersionOptions): Promise<string> {
    const { code, prompt, timestamp, isValid, kicadFiles } = options

    const versionId = this.formatTimestamp(timestamp)
    const versionDir = join(this.versionsDir, versionId)
    const codeFilePath = join(versionDir, 'code.tsx')

    await mkdir(versionDir, { recursive: true })
    await writeFile(codeFilePath, code, 'utf-8')

    const relativeCodePath = `.eai/versions/${versionId}/code.tsx`

    const version: WorkspaceVersion = {
      id: versionId,
      prompt,
      codeFile: relativeCodePath,
      timestamp,
      isValid,
      kicadFiles,
    }

    await this.updateMeta(meta => ({
      ...meta,
      versions: [...meta.versions, version],
      currentVersion: versionId,
      lastModified: timestamp,
    }))

    if (kicadFiles) {
      await this.writeKiCadFiles(kicadFiles.pcb, kicadFiles.sch)
    }

    logger.info('version-created', `Version ${versionId} created`, { versionId, isValid })

    return versionId
  }

  async saveGeneratedResult(options: SaveWorkspaceResultRequest): Promise<string> {
    const { code, prompt, kicadFiles, timestamp = Date.now(), isValid = true, versionId } = options

    if (versionId) {
      await this.updateVersionCode(versionId, code, isValid)
      if (kicadFiles) {
        await this.writeKiCadFiles(kicadFiles.pcb, kicadFiles.sch)
      }
      await this.updateMeta(meta => ({
        ...meta,
        versions: meta.versions.map(v => (v.id === versionId ? { ...v, prompt, kicadFiles, timestamp } : v)),
        lastModified: Date.now(),
      }))
      return versionId
    }

    return this.createVersion({
      code,
      prompt,
      timestamp,
      isValid,
      kicadFiles,
    })
  }

  async getCurrentVersion(): Promise<WorkspaceVersion | null> {
    const meta = await this.getMeta()
    if (!meta || !meta.currentVersion) {
      return null
    }

    return meta.versions.find(v => v.id === meta.currentVersion) || null
  }

  async getVersion(versionId: string): Promise<WorkspaceVersion | null> {
    const meta = await this.getMeta()
    if (!meta) {
      return null
    }

    return meta.versions.find(v => v.id === versionId) || null
  }

  async checkoutVersion(versionId: string): Promise<void> {
    const version = await this.getVersion(versionId)
    if (!version) {
      throw new Error(`Version ${versionId} not found`)
    }

    if (version.kicadFiles) {
      await this.writeKiCadFiles(version.kicadFiles.pcb, version.kicadFiles.sch)
    }

    await this.updateMeta(meta => ({
      ...meta,
      currentVersion: versionId,
      lastModified: Date.now(),
    }))

    logger.info('version-checkout', `Checked out version ${versionId}`, { versionId })
  }

  async deleteVersion(versionId: string): Promise<void> {
    const version = await this.getVersion(versionId)
    if (!version) {
      throw new Error(`Version ${versionId} not found`)
    }

    const versionDir = join(this.versionsDir, versionId)

    try {
      const files = await readdir(versionDir)
      await Promise.all(files.map(f => unlink(join(versionDir, f))))
    } catch {}

    await this.updateMeta(meta => {
      const filtered = meta.versions.filter(v => v.id !== versionId)
      const lastVersion = filtered.length > 0 ? filtered[filtered.length - 1] : undefined
      const newCurrentVersion =
        meta.currentVersion === versionId ? (lastVersion?.id ?? null) : meta.currentVersion

      return {
        ...meta,
        versions: filtered,
        currentVersion: newCurrentVersion,
        lastModified: Date.now(),
      }
    })

    logger.info('version-deleted', `Version ${versionId} deleted`, { versionId })
  }

  async listVersions(): Promise<WorkspaceVersion[]> {
    const meta = await this.getMeta()
    return meta?.versions || []
  }

  async readVersionCode(versionId: string): Promise<string | null> {
    const version = await this.getVersion(versionId)
    if (!version) {
      return null
    }

    const codePath = join(this.workspacePath, version.codeFile)

    try {
      return await readFile(codePath, 'utf-8')
    } catch {
      return null
    }
  }

  async updateVersionCode(versionId: string, newCode: string, isValid: boolean): Promise<void> {
    const version = await this.getVersion(versionId)
    if (!version) {
      throw new Error(`Version ${versionId} not found`)
    }

    const codePath = join(this.workspacePath, version.codeFile)
    await writeFile(codePath, newCode, 'utf-8')

    await this.updateMeta(meta => ({
      ...meta,
      versions: meta.versions.map(v => (v.id === versionId ? { ...v, isValid } : v)),
      lastModified: Date.now(),
    }))

    logger.info('version-code-updated', `Version ${versionId} code updated`, {
      versionId,
      isValid,
      codeLength: newCode.length,
    })
  }

  async writeKiCadFiles(pcb: string, sch: string): Promise<void> {
    await writeFile(join(this.workspacePath, 'project.kicad_pcb'), pcb, 'utf-8')
    await writeFile(join(this.workspacePath, 'project.kicad_sch'), sch, 'utf-8')
  }

  async exists(): Promise<boolean> {
    try {
      await stat(this.metaPath)
      return true
    } catch {
      return false
    }
  }

  private formatTimestamp(timestamp: number): string {
    const date = new Date(timestamp)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hour = String(date.getHours()).padStart(2, '0')
    const minute = String(date.getMinutes()).padStart(2, '0')
    const second = String(date.getSeconds()).padStart(2, '0')

    return `${year}${month}${day}_${hour}${minute}${second}`
  }
}
