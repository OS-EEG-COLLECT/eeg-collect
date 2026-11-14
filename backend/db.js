// 1. Define and set the URL BEFORE importing the PrismaClient,
// so Prisma never reads "undefined".
const dbUrl = 'file:./dev.db';
process.env.DATABASE_URL = dbUrl;

const { PrismaClient } = require('@prisma/client');

const prismaPromise = (async () => {
  const mod = await import('@prisma/adapter-libsql');
  const PrismaLibSQL = mod.PrismaLibSql || mod.PrismaLibSQL || mod.default?.PrismaLibSql || mod.default;

  // 2. Pass the configuration object directly to the adapter
  const adapter = new PrismaLibSQL({
    url: dbUrl,
  });

  return new PrismaClient({ adapter });
})();

async function getPrismaClient() {
  return await prismaPromise;
}

module.exports = { getPrismaClient };