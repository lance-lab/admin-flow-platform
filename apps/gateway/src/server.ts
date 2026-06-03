import cors from 'cors';
import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { authenticate, requirePermission, signUser } from './auth.js';
import { config } from './config.js';
import { createSetupToken, hashPassword, hashSetupToken, verifyPassword } from './passwords.js';
import {
  completePasswordSetup,
  createPasswordSetupToken,
  createPlatformUser,
  deletePlatformUser,
  findEnabledModuleByCode,
  findPasswordSetupToken,
  findUserByEmail,
  findUserPasswordHashByEmail,
  listEnabledModules,
  listPlatformRoles,
  listPlatformUsers,
  listEnabledModulesForPermissions,
  updatePlatformUser
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
    const password = String(req.body.password ?? '');
    const user = await findUserByEmail(email);
    const passwordHash = await findUserPasswordHashByEmail(email);

    if (!user || !verifyPassword(password, passwordHash)) {
      res.status(401).json({ message: 'Invalid email or password' });
      return;
    }

    const token = signUser(user);
    res.json({ token, user });
  } catch (error) {
    next(error);
  }
});

app.get('/api/auth/password-setup/:token', async (req, res, next) => {
  try {
    const tokenHash = hashSetupToken(String(req.params.token));
    const setup = await findPasswordSetupToken(tokenHash);
    const expired = setup ? new Date(setup.expires_at).getTime() < Date.now() : true;

    if (!setup || setup.used_at || expired) {
      res.status(404).json({ message: 'Password setup link is invalid or expired' });
      return;
    }

    res.json({
      user: {
        email: setup.email,
        displayName: setup.display_name
      }
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/auth/password-setup/:token', async (req, res, next) => {
  try {
    const password = String(req.body.password ?? '');

    if (password.length < 8) {
      res.status(400).json({ message: 'Password must have at least 8 characters' });
      return;
    }

    const tokenHash = hashSetupToken(String(req.params.token));
    const setup = await findPasswordSetupToken(tokenHash);
    const expired = setup ? new Date(setup.expires_at).getTime() < Date.now() : true;

    if (!setup || setup.used_at || expired) {
      res.status(404).json({ message: 'Password setup link is invalid or expired' });
      return;
    }

    await completePasswordSetup({
      tokenId: setup.id,
      userId: setup.user_id,
      passwordHash: hashPassword(password)
    });

    res.json({ success: true });
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

app.get('/api/platform/health', authenticate, requirePermission('platform.modules.read'), async (req, res, next) => {
  try {
    const locale = String(req.query.locale ?? req.user?.locale ?? 'sk');
    const modules = await listEnabledModules(locale);
    const moduleChecks = await Promise.all(
      modules.map(async (module) => {
        try {
          const response = await fetch(`${module.backendBaseUrl}/health`, {
            signal: AbortSignal.timeout(2000)
          });
          return {
            code: module.code,
            name: module.name,
            status: response.ok ? 'ok' : 'error',
            detail: response.ok ? 'Reachable' : `HTTP ${response.status}`
          };
        } catch {
          return {
            code: module.code,
            name: module.name,
            status: 'error',
            detail: 'Unreachable'
          };
        }
      })
    );

    res.json({
      services: [
        { code: 'gateway', name: 'Gateway API', status: 'ok', detail: 'Reachable' },
        { code: 'postgres', name: 'PostgreSQL', status: 'ok', detail: 'Connected' },
        ...moduleChecks
      ]
    });
  } catch (error) {
    next(error);
  }
});

app.get(
  '/api/platform/users',
  authenticate,
  requirePermission('platform.users.read'),
  async (_req, res, next) => {
    try {
      const users = await listPlatformUsers();
      res.json({ users });
    } catch (error) {
      next(error);
    }
  }
);

app.get(
  '/api/platform/roles',
  authenticate,
  requirePermission('platform.users.manage'),
  async (_req, res, next) => {
    try {
      const roles = await listPlatformRoles();
      res.json({ roles });
    } catch (error) {
      next(error);
    }
  }
);

app.post(
  '/api/platform/users',
  authenticate,
  requirePermission('platform.users.manage'),
  async (req, res, next) => {
    try {
      const email = String(req.body.email ?? '').trim().toLowerCase();
      const displayName = String(req.body.displayName ?? '').trim();
      const locale = req.body.locale === 'en' ? 'en' : 'sk';
      const roleCodes = Array.isArray(req.body.roleCodes)
        ? (req.body.roleCodes as unknown[]).map((role) => String(role))
        : ['admin'];

      if (!email || !displayName) {
        res.status(400).json({ message: 'Email and display name are required' });
        return;
      }

      const user = await createPlatformUser({ email, displayName, locale, roleCodes });
      const setupToken = createSetupToken();
      const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);

      await createPasswordSetupToken({
        userId: user.id,
        tokenHash: hashSetupToken(setupToken),
        expiresAt
      });

      res.status(201).json({
        user,
        setupUrl: `${config.webBaseUrl}/setup-password?token=${setupToken}`,
        expiresAt: expiresAt.toISOString()
      });
    } catch (error) {
      next(error);
    }
  }
);

app.patch(
  '/api/platform/users/:userId',
  authenticate,
  requirePermission('platform.users.manage'),
  async (req, res, next) => {
    try {
      const userId = String(req.params.userId);
      const displayName = String(req.body.displayName ?? '').trim();
      const locale = req.body.locale === 'en' ? 'en' : 'sk';
      const active = Boolean(req.body.active);
      const roleCodes = Array.isArray(req.body.roleCodes)
        ? (req.body.roleCodes as unknown[]).map((role) => String(role))
        : [];

      if (!displayName) {
        res.status(400).json({ message: 'Display name is required' });
        return;
      }

      const updated = await updatePlatformUser({ id: userId, displayName, locale, active, roleCodes });

      if (!updated) {
        res.status(404).json({ message: 'User not found' });
        return;
      }

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
);

app.delete(
  '/api/platform/users/:userId',
  authenticate,
  requirePermission('platform.users.manage'),
  async (req, res, next) => {
    try {
      const userId = String(req.params.userId);

      if (req.user?.id === userId) {
        res.status(400).json({ message: 'You cannot delete your own account' });
        return;
      }

      const deleted = await deletePlatformUser(userId);

      if (!deleted) {
        res.status(404).json({ message: 'User not found' });
        return;
      }

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
);

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
