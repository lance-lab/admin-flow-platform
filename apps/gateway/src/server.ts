import cors from 'cors';
import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { authenticate, signUser } from './auth.js';
import { config } from './config.js';
import {
  findEnabledModuleByCode,
  findUserByEmail,
  listEnabledModulesForPermissions
} from './repositories/platformRepository.js';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'gateway' });
});

app.post('/api/auth/login', async (req, res, next) => {
  try {
    const email = String(req.body.email ?? 'admin@example.com').trim().toLowerCase();
    const user = (await findUserByEmail(email)) ?? (await findUserByEmail('admin@example.com'));

    if (!user) {
      res.status(401).json({ message: 'Demo admin user is not seeded' });
      return;
    }

    const token = signUser(user);
    res.json({ token, user });
  } catch (error) {
    next(error);
  }
});

app.get('/api/auth/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

app.get('/api/platform/modules', authenticate, async (req, res, next) => {
  try {
    const locale = String(req.query.locale ?? req.user?.locale ?? 'sk');
    const modules = await listEnabledModulesForPermissions(req.user?.permissions ?? [], locale);
    res.json({ modules });
  } catch (error) {
    next(error);
  }
});

app.use('/api/modules/:moduleCode', authenticate, async (req, res, next) => {
  try {
    const moduleCode = String(req.params.moduleCode);
    const module = await findEnabledModuleByCode(moduleCode);

    if (!module) {
      res.status(404).json({ message: `Unknown module: ${moduleCode}` });
      return;
    }

    if (!req.user?.permissions.includes(module.requiredPermission)) {
      res.status(403).json({ message: `Missing permission: ${module.requiredPermission}` });
      return;
    }

    return createProxyMiddleware({
      target: module.backendBaseUrl,
      changeOrigin: true,
      pathRewrite: (path) => `/api${path}`
    })(req, res, next);
  } catch (error) {
    next(error);
  }
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(error);
  res.status(500).json({ message: 'Unexpected gateway error' });
});

app.listen(config.port, () => {
  console.log(`Gateway listening on ${config.port}`);
});
