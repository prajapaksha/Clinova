import { Global, Injectable, Module, NotFoundException } from '@nestjs/common';
import { mkdir, readFile, rm, writeFile } from 'fs/promises';
import { dirname, join, resolve, sep } from 'path';

/**
 * Document storage on local disk (FILE_STORAGE_DIR, default ./storage).
 * Keys are relative paths; swap for object storage (S3) in production.
 */
@Injectable()
export class FileStorageService {
  private readonly root = resolve(process.env['FILE_STORAGE_DIR'] ?? join(process.cwd(), 'storage'));

  async save(key: string, data: Buffer): Promise<void> {
    const path = this.path(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, data);
  }

  async read(key: string): Promise<Buffer> {
    try {
      return await readFile(this.path(key));
    } catch {
      throw new NotFoundException('The file for this document is not available.');
    }
  }

  async remove(key: string): Promise<void> {
    await rm(this.path(key), { force: true });
  }

  private path(key: string): string {
    const path = resolve(this.root, key);
    if (!path.startsWith(this.root + sep)) throw new NotFoundException('Invalid document path.');
    return path;
  }
}

/** File names safe for storage keys and Content-Disposition headers. */
export function safeFileName(name: string): string {
  return name.normalize('NFKD').replace(/[^\w.-]+/g, '_').replace(/_+/g, '_').slice(-120) || 'file';
}

@Global()
@Module({ providers: [FileStorageService], exports: [FileStorageService] })
export class StorageModule {}