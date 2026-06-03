import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT ?? 3000),
  databaseUrl:
    process.env.DATABASE_URL ??
    'postgresql://admin_flow:admin_flow@localhost:5432/admin_flow',
  jwtSecret: process.env.JWT_SECRET ?? 'replace-in-real-environments',
  webBaseUrl: process.env.WEB_BASE_URL ?? 'http://localhost:5173'
};
