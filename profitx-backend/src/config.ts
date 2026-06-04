export const config = {
  port: Number(process.env.PORT ?? 4000),
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
  appSecret: process.env.APP_SECRET ?? 'change-me',
  databaseUrl: process.env.DATABASE_URL ?? '',
};
