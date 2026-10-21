import { Request, Response } from 'express';
import { BaseController } from './baseController';
import { isDbConnected } from '../config/database';
import { env } from '../config/env';

export class HealthController extends BaseController {
  public getHealth = (req: Request, res: Response): Response => {
    const healthData = {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      environment: env.NODE_ENV,
      serverMode: env.SERVER_MODE.toUpperCase(),
      database: {
        connected: isDbConnected(),
        type: 'MongoDB',
      },
      memory: {
        heapUsedMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        rssMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
      },
    };

    return res.success(healthData, 'System is healthy');
  };

  public getRoot = (req: Request, res: Response): Response => {
    return res.success(
      {
        name: 'Enterprise AI Knowledge & Support Copilot API',
        version: '1.0.0',
        environment: env.NODE_ENV,
        serverMode: env.SERVER_MODE.toUpperCase(),
        docs: '/api/docs',
        health: `${env.API_PREFIX}/health`,
      },
      'Welcome to the Support Copilot API'
    );
  };
}

export const healthController = new HealthController();
export default healthController;
