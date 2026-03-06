import { serve } from 'bun'
import index from './index.html'
import { getConfig, isDevelopment } from './lib/config'
import { POST as compilePost } from './routes/compile'
import { POST as compileAndConvertPost } from './routes/compile-and-convert'
import { POST as convertPost } from './routes/convert'
import { POST as exportPost } from './routes/export'
import { POST as generatePost } from './routes/generate'

const _config = getConfig()

const server = serve({
  routes: {
    '/*': index,

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
  },

  development: isDevelopment() && {
    hmr: true,
    console: true,
  },
})

console.log(`🚀 Server running at ${server.url}`)
