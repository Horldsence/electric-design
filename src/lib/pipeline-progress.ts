import { socketManager } from './socket-manager'

/**
 * Pipeline stage identifiers — each maps 1:1 to a front-end display state.
 * Kept as a narrow union so both server and client share the same vocabulary.
 */
export type PipelineStage =
  | 'compiling'
  | 'validating'
  | 'converting'
  | 'rendering'
  | 'completed'
  | 'failed'

/**
 * Structured progress event pushed over WebSocket.
 * Unlike log entries (free-form text for humans), this is the single
 * source of truth that drives the front-end progress indicator.
 */
export type PipelineProgressEvent = {
  sessionId: string
  stage: PipelineStage
  detail?: string
}

/**
 * Broadcast a progress event to all connected WebSocket clients.
 *
 * Messages use type "pipeline:progress" so the client can distinguish
 * them from generic "log" messages without any string-matching heuristics.
 */
function emitProgress(event: PipelineProgressEvent): void {
  socketManager.broadcast({
    type: 'pipeline:progress',
    payload: event,
  })
}

/**
 * Create a stage emitter bound to a specific session.
 *
 * Usage in a route handler:
 *
 *   const progress = createProgressEmitter(sessionId)
 *   progress.stage('compiling')
 *   const result = await compilerService.compile(sessionId, code)
 *   progress.stage('validating')
 *   ...
 *   progress.completed()
 *
 * Each call is a single broadcast — no state is stored server-side.
 * The front-end is responsible for matching sessionId and updating its
 * own state machine accordingly.
 */
export function createProgressEmitter(sessionId: string) {
  return {
    stage(s: Exclude<PipelineStage, 'completed' | 'failed'>, detail?: string) {
      emitProgress({ sessionId, stage: s, detail })
    },

    completed(detail?: string) {
      emitProgress({ sessionId, stage: 'completed', detail })
    },

    failed(detail?: string) {
      emitProgress({ sessionId, stage: 'failed', detail })
    },
  }
}