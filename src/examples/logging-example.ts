import { createPipelineLogger } from './lib/debug'

const log = createPipelineLogger('example', 'session_123')

async function example() {
  log.info('Starting example operation')

  const stage = log.stage('data-processing')

  await stage.measure('heavy-computation', async () => {
    stage.debug('Processing data', { itemCount: 1000 })
    await new Promise(resolve => setTimeout(resolve, 100))
  })

  stage.info('Processing complete', {
    processed: 1000,
    duration: 100,
  })

  log.info('Example completed')
}

try {
  await example()
} catch (error) {
  log.error('Example failed', error)
}
