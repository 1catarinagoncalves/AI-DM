import path from 'node:path';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  datasource: {
    url: env('DATABASE_URL'),
    // US-93 gate 1: só o `migrate diff --from-migrations` do CI usa isto — ele replica
    // as migrações num banco de verdade para comparar com o schema. No Prisma 7 não há
    // mais a flag `--shadow-database-url`; o valor vem daqui. process.env cru e não
    // env(): env() exige a variável e quebraria todo comando Prisma local, onde o
    // shadow não existe.
    shadowDatabaseUrl: process.env['SHADOW_DATABASE_URL'],
  },
  migrations: {
    seed: 'ts-node prisma/seed.ts',
  },
});
