import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import Database from 'better-sqlite3';
import { PrismaService } from '../prisma/prisma.service';

const MIGRATIONS_DIR = resolve(__dirname, '../../../../prisma/migrations');

/**
 * Creates an isolated SQLite database with all Prisma migrations applied, for
 * integration tests of services with relational logic. Call `cleanup()` afterwards.
 */
export async function createTestDatabase(): Promise<{ prisma: PrismaService; cleanup: () => Promise<void> }> {
  const dir = mkdtempSync(join(tmpdir(), 'clinova-test-'));
  const file = join(dir, 'test.db');

  const db = new Database(file);
  for (const migration of readdirSync(MIGRATIONS_DIR).filter(d => /^\d+_/.test(d)).sort()) {
    db.exec(readFileSync(join(MIGRATIONS_DIR, migration, 'migration.sql'), 'utf8'));
  }
  db.close();

  const previous = process.env['DATABASE_URL'];
  process.env['DATABASE_URL'] = `file:${file}`;
  const prisma = new PrismaService();
  process.env['DATABASE_URL'] = previous;
  await prisma.$connect();

  return {
    prisma,
    cleanup: async () => {
      await prisma.$disconnect();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
