import Database from 'better-sqlite3';
import path from 'node:path';
import { app } from 'electron';

const dbPath = path.join(app.getPath('userData'), 'downloads.db');

export interface DownloadRecord {
    id: string;
    url: string;
    filename: string;
    savedPath: string;
    totalSize: number;
    downloadedSize: number;
    status: 'PENDING' | 'DOWNLOADING' | 'PAUSED' | 'COMPLETED' | 'ERROR' | 'WAITING_FOR_SPACE';
    created_at: string;
    fileHash?: string;
    speed?: number;
}

class DownloadsDatabase {
    private db: Database.Database;

    constructor() {
        this.db = new Database(dbPath);
        this.init();
    }

    private init() {
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS downloads (
        id TEXT PRIMARY KEY,
        url TEXT NOT NULL,
        filename TEXT,
        savedPath TEXT,
        totalSize INTEGER,
        downloadedSize INTEGER,
        status TEXT,
        created_at DATETIME,
        fileHash TEXT
      )
    `);
    }

    public addDownload(record: DownloadRecord) {
        const stmt = this.db.prepare(`
      INSERT INTO downloads (id, url, filename, savedPath, totalSize, downloadedSize, status, created_at, fileHash)
      VALUES (@id, @url, @filename, @savedPath, @totalSize, @downloadedSize, @status, @created_at, @fileHash)
    `);
        stmt.run({ ...record, fileHash: record.fileHash || null });
    }

    public updateDownload(id: string, updates: Partial<DownloadRecord>) {
        const keys = Object.keys(updates).filter(k => k !== 'id');
        if (keys.length === 0) return;

        const setClause = keys.map(k => `${k} = @${k}`).join(', ');
        const stmt = this.db.prepare(`
      UPDATE downloads SET ${setClause} WHERE id = @id
    `);
        stmt.run({ ...updates, id });
    }

    public getDownload(id: string): DownloadRecord | undefined {
        const stmt = this.db.prepare('SELECT * FROM downloads WHERE id = ?');
        return stmt.get(id) as DownloadRecord | undefined;
    }

    public getAllDownloads(): DownloadRecord[] {
        const stmt = this.db.prepare('SELECT * FROM downloads ORDER BY created_at DESC');
        return stmt.all() as DownloadRecord[];
    }

    public deleteDownload(id: string) {
        const stmt = this.db.prepare('DELETE FROM downloads WHERE id = ?');
        stmt.run(id);
    }

    public clearAll() {
        const stmt = this.db.prepare('DELETE FROM downloads');
        stmt.run();
    }

    public moveToEnd(id: string) {
        // Update created_at to current time to move to end of list
        const stmt = this.db.prepare('UPDATE downloads SET created_at = ? WHERE id = ?');
        stmt.run(new Date().toISOString(), id);
    }
}

export const downloadsDb = new DownloadsDatabase();
