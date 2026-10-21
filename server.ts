import fs from 'fs';
import http from 'http';
import https from 'https';
import app from './src/app';
import { env } from './src/config/env';
import { connectDatabase, disconnectDatabase } from './src/config/database';
import { initRedis, closeRedis } from './src/config/redis';

export class Server {
  private server: http.Server | https.Server | null = null;

  public async start(): Promise<void> {
    try {
      console.log('='.repeat(60));
      console.log('Starting Enterprise AI Knowledge & Support Copilot Server...');
      console.log('='.repeat(60));

      await this.connectDatabases();
      this.server = this.createServerInstance();
      this.listen();
      this.setupProcessEvents();
    } catch (error) {
      console.error('[Fatal Error] Server failed to start:', error);
      process.exit(1);
    }
  }

  private async connectDatabases(): Promise<void> {
    try {
      await connectDatabase();
    } catch (dbError) {
      console.error('[Startup Warning] MongoDB connection failed:', (dbError as Error).message);
      if (env.NODE_ENV === 'production') {
        console.error('[Critical] Cannot run in production without MongoDB. Exiting...');
        process.exit(1);
      }
      console.warn('[Startup Warning] Running in development mode without active MongoDB.');
    }

    initRedis();
  }

  private createServerInstance(): http.Server | https.Server {
    if (env.SERVER_MODE === 'https') {
      if (!env.SSL_KEY_PATH || !env.SSL_CERT_PATH) {
        throw new Error(
          'SERVER_MODE is set to "https" but SSL_KEY_PATH or SSL_CERT_PATH is missing in environment variables.'
        );
      }

      if (!fs.existsSync(env.SSL_KEY_PATH)) {
        throw new Error(`SSL key file not found at path: ${env.SSL_KEY_PATH}`);
      }

      if (!fs.existsSync(env.SSL_CERT_PATH)) {
        throw new Error(`SSL certificate file not found at path: ${env.SSL_CERT_PATH}`);
      }

      const sslOptions: https.ServerOptions = {
        key: fs.readFileSync(env.SSL_KEY_PATH, 'utf8'),
        cert: fs.readFileSync(env.SSL_CERT_PATH, 'utf8'),
        ...(env.SSL_CA_PATH && fs.existsSync(env.SSL_CA_PATH)
          ? { ca: fs.readFileSync(env.SSL_CA_PATH, 'utf8') }
          : {}),
      };

      console.log('[Server] SSL certificates loaded successfully. Running in HTTPS mode.');
      return https.createServer(sslOptions, app);
    }

    console.log('[Server] Running in HTTP mode.');
    return http.createServer(app);
  }

  private listen(): void {
    if (!this.server) return;

    const protocol = env.SERVER_MODE === 'https' ? 'https' : 'http';
    const baseUrl = env.SITE_URL || `${protocol}://localhost:${env.PORT}`;

    this.server.listen(env.PORT, () => {
      console.log(
        `[Server] Server listening on port: ${env.PORT} [${env.SERVER_MODE.toUpperCase()}]`
      );
      console.log(`[Server] Environment: ${env.NODE_ENV}`);
      console.log(`[Server] Site URL: ${baseUrl}`);
      console.log(`[Server] API Base URL: ${baseUrl}${env.API_PREFIX}`);
      console.log(`[Server] Health Check: ${baseUrl}${env.API_PREFIX}/health`);
      console.log('='.repeat(60));
    });
  }

  private setupProcessEvents(): void {
    process.on('SIGTERM', () => this.gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => this.gracefulShutdown('SIGINT'));

    process.on('unhandledRejection', (reason: unknown) => {
      console.error('[Fatal] Unhandled Promise Rejection:', reason);
    });

    process.on('uncaughtException', (error: Error) => {
      console.error('[Fatal] Uncaught Exception:', error);
      this.gracefulShutdown('uncaughtException');
    });
  }

  public gracefulShutdown = async (signal: string): Promise<void> => {
    console.log(`\n[Shutdown] ${signal} signal received. Starting graceful shutdown...`);

    if (this.server) {
      this.server.close(async () => {
        console.log(`[Shutdown] ${env.SERVER_MODE.toUpperCase()} server closed for new requests.`);

        try {
          await disconnectDatabase();
          await closeRedis();
          console.log('[Shutdown] Clean exit completed.');
          process.exit(0);
        } catch (err) {
          console.error('[Shutdown Error] Error during connection teardown:', err);
          process.exit(1);
        }
      });

      setTimeout(() => {
        console.error('[Shutdown] Forced shutdown after timeout (10s).');
        process.exit(1);
      }, 10000).unref();
    } else {
      process.exit(0);
    }
  };
}

const serverInstance = new Server();
serverInstance.start();

export default serverInstance;
