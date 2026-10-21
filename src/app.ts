import path from 'path';
import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env';
import { requestLogger } from './middleware/requestLogger';
import { responseMiddleware } from './middleware/responseHandler';
import { i18nMiddleware } from './i18n';
import { errorHandler } from './middleware/errorHandler';
import { notFoundHandler } from './middleware/notFoundHandler';
import apiRoutes from './routes';
import docsRoutes from './docs';

export class App {
  public app: Application;

  constructor() {
    this.app = express();
    this.configureMiddlewares();
    this.configureRoutes();
    this.configureErrorHandling();
  }

  private configureMiddlewares(): void {
    this.app.use(
      helmet({
        contentSecurityPolicy: false,
      })
    );
    this.app.use(
      cors({
        origin: env.CORS_ORIGIN,
        credentials: true,
      })
    );
    this.app.use(requestLogger);
    this.app.use(i18nMiddleware);
    this.app.use(responseMiddleware);
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    this.app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
  }

  private configureRoutes(): void {
    this.app.use('/api/docs', docsRoutes);
    this.app.use('/docs', docsRoutes);

    this.app.get('/', (req: Request, res: Response) => {
      return res.success(
        {
          status: 'online',
          serverMode: env.SERVER_MODE.toUpperCase(),
          healthCheck: `${env.API_PREFIX}/health`,
          docs: '/api/docs',
          apiPrefix: env.API_PREFIX,
        },
        'Enterprise AI Knowledge & Support Copilot API Server'
      );
    });

    this.app.use(env.API_PREFIX, apiRoutes);
  }

  private configureErrorHandling(): void {
    this.app.use(notFoundHandler);
    this.app.use(errorHandler);
  }
}

const application = new App();
export default application.app;
