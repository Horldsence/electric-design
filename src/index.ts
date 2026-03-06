import { serve } from 'bun'
import index from './index.html'
import { getConfig, isDevelopment } from './lib/config'
import { POST as compilePost } from './routes/compile'
import { POST as compileAndConvertPost } from './routes/compile-and-convert'
import { POST as convertPost } from './routes/convert'
import { POST as exportPost } from './routes/export'
import { POST as generatePost } from './routes/generate'
import {
  autoFixValidation,
  checkKiCad,
  exportBom,
  exportGerber,
  validateKiCad,
} from './routes/validate-kicad'
import {
  downloadKiCad,
  downloadSchematic,
  downloadGerbers,
  downloadBomFile,
} from './routes/download'
import { socketManager, type WebSocketData } from './lib/socket-manager'

const _config = getConfig()

const server = serve<WebSocketData>({
  routes: {
    '/': index,

    '/api/hello': {
      async GET(_req) {
        return Response.json({
          message: 'Hello, world!',
          method: 'GET',
        })
      },
      async PUT(_req) {
        return Response.json({
          message: 'Hello, world!',
          method: 'PUT',
        })
      },
    },

    '/api/hello/:name': async req => {
      const name = req.params.name
      return Response.json({
        message: `Hello, ${name}!`,
      })
    },

    '/api/export': {
      POST: exportPost,
    },

    '/api/generate': {
      POST: generatePost,
    },

    '/api/compile': {
      POST: compilePost,
    },

    '/api/convert': {
      POST: convertPost,
    },

    '/api/compile-and-convert': {
      POST: compileAndConvertPost,
    },

    '/api/validate-kicad': {
      POST: validateKiCad,
    },

    '/api/check-kicad': {
      POST: checkKiCad,
    },

    '/api/export-gerber': {
      POST: exportGerber,
    },

    '/api/export-bom': {
      POST: exportBom,
    },

    '/api/auto-fix-validation': {
      POST: autoFixValidation,
    },

    '/api/download-kicad': {
      POST: downloadKiCad,
    },

    '/api/download-schematic': {
      POST: downloadSchematic,
    },

    '/api/download-gerbers': {
      POST: downloadGerbers,
    },

    '/api/download-bom': {
      POST: downloadBomFile,
    },
  },

  fetch(req, server) {
    const url = new URL(req.url)
    if (url.pathname === '/ws') {
      const success = server.upgrade(req, {
        data: {
          id: crypto.randomUUID(),
          createdAt: Date.now(),
        },
      })
      return success ? undefined : new Response('WebSocket upgrade failed', { status: 400 })
    }

    return new Response('Not found', { status: 404 })
  },

  websocket: {
    message: (ws, message) => socketManager.handleMessage(ws, message),
    open: (ws) => socketManager.handleOpen(ws),
    close: (ws) => socketManager.handleClose(ws),
  },

  development: isDevelopment() && {
    hmr: true,
    console: true,
  },
})

console.log(`🚀 Server running at ${server.url}`)