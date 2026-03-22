import {buildApp} from './app'
import {env} from './config/env'
import { startWebhookWorker } from './workers/webhookWorker';

const startServer = async () => {
    const app = await buildApp();
    // Start webhook worker
    startWebhookWorker()
    try{
        await app.listen({ port: env.PORT, host: '0.0.0.0' })
        console.log(`InfraCore running on port ${env.PORT}`)
    }catch (error) {
        console.error('Error starting server:', error)
        app.log.error(error)
        process.exit(1)
    }
}

startServer();