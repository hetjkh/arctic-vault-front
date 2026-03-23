import fs from 'fs/promises';
import path from 'path';
import { DBData } from '@/types';

const DB_PATH = path.join(process.cwd(), 'data', 'db.json');

export async function readDB(): Promise<DBData> {
  const raw = await fs.readFile(DB_PATH, 'utf-8');
  return JSON.parse(raw) as DBData;
}

export async function writeDB(data: DBData): Promise<void> {
  await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
}
