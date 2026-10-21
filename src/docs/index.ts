import path from 'path';
import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';

const router = Router();

const yamlPath = path.join(process.cwd(), 'src', 'docs', 'swagger.yaml');
const swaggerDocument = YAML.load(yamlPath);

router.use(
  '/',
  swaggerUi.serve,
  swaggerUi.setup(swaggerDocument, {
    customSiteTitle: 'Enterprise Support Copilot API Documentation',
    swaggerOptions: {
      filter: true,
      displayRequestDuration: true,
      persistAuthorization: true,
      docExpansion: 'list',
    },
  })
);

export default router;
