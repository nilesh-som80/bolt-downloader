import EventEmitter from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import axios from 'axios';
import crypto from 'node:crypto';
import os from 'node:os';
import { configManager } from './ConfigManager';
import { DownloadRecord } from './Database';
import { v4 as uuidv4 } from 'uuid';

export interface DownloadTaskConfig {
    url: string;
    savePath?: string; // Optional override
    filename?: string; // Optional override
    id?: string; // For resuming
}

interface Chunk {
    start: number;
    end: number;
    tempFile: string;
    downloaded: number;
    done: boolean;
}

// 64MB buffer for RAM heuristic
const RAM_CHUNK_OVERHEAD = 64 * 1024 * 1024;

export class DownloadTask extends EventEmitter {
    public id: string;
    public url: string;
    public savedPath: string = '';
    public originalFilename: string = '';
    public totalSize: number = 0;
    public downloadedSize: number = 0;
    public status: DownloadRecord['status'] = 'PENDING';
    public created_at: string;

    private tempDir: string;
    private chunks: Chunk[] = [];
    private abortControllers: AbortController[] = [];
    private userHash?: string;

    // Speed calculation
    private speedInterval: NodeJS.Timeout | null = null;
    private lastBytes: number = 0;
    public speed: number = 0;

    constructor(config: DownloadTaskConfig) {
        super();
        this.id = config.id || uuidv4();
        this.url = config.url;
        this.created_at = new Date().toISOString();

        // Default path setup - ensure it's a directory path
        const defaultDir = config.savePath || configManager.get('defaultDownloadPath');
        // savedPath starts as directory, filename will be appended in init()
        this.savedPath = defaultDir;
        this.tempDir = path.join(app.getPath('temp'), `idm-clone-${this.id}`);
    }

    // Helper to emit status updates
    private emitProgress() {
        this.emit('progress', {
            id: this.id,
            totalSize: this.totalSize,
            downloadedSize: this.downloadedSize,
            status: this.status,
            speed: this.speed
        });
    }

    private startSpeedTracking() {
        if (this.speedInterval) clearInterval(this.speedInterval);
        this.lastBytes = this.downloadedSize;
        this.speed = 0;

        this.speedInterval = setInterval(() => {
            const nowBytes = this.downloadedSize;
            const diff = nowBytes - this.lastBytes;
            // 500ms interval, so speed (bytes/s) = diff * 2
            this.speed = diff * 2;
            this.lastBytes = nowBytes;
            this.emitProgress();
        }, 500);
    }

    private stopSpeedTracking() {
        if (this.speedInterval) {
            clearInterval(this.speedInterval);
            this.speedInterval = null;
        }
        this.speed = 0;
    }

    public getChunkInfo() {
        return this.chunks.map((chunk, index) => {
            const chunkSize = chunk.end - chunk.start + 1;
            const progress = chunkSize > 0 ? (chunk.downloaded / chunkSize) * 100 : 0;

            return {
                chunkIndex: index,
                start: chunk.start,
                end: chunk.end,
                downloaded: chunk.downloaded,
                progress: parseFloat(progress.toFixed(7)), // Accurate to 7 decimal places
                done: chunk.done,
                size: chunkSize
            };
        });
    }

    public async init() {
        try {
            this.status = 'PENDING';
            this.emitProgress();

            // 1. HEAD Request
            const response = await axios.head(this.url, {
                maxRedirects: 10,
                validateStatus: (status) => status >= 200 && status < 300 // Accept 2xx
            });

            this.totalSize = parseInt(response.headers['content-length'] || '0');
            const acceptRanges = response.headers['accept-ranges'];
            const contentDisposition = response.headers['content-disposition'];

            // Filename Parsing
            let filename = '';
            if (contentDisposition) {
                // Try RFC 5987 format first (filename*=UTF-8''filename.ext)
                const rfc5987Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
                if (rfc5987Match) {
                    filename = decodeURIComponent(rfc5987Match[1].trim());
                } else {
                    // Fall back to regular format
                    const regularMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
                    if (regularMatch) {
                        filename = regularMatch[1].trim();
                    }
                }
            }
            if (!filename) {
                filename = path.basename(new URL(this.url).pathname) || 'download.file';
            }
            this.originalFilename = filename;
            this.savedPath = path.join(this.savedPath, filename);

            // 2. Disk Space Check
            const stats = await fs.promises.statfs(path.dirname(this.savedPath));
            if (stats.bavail * stats.bsize < this.totalSize) {
                this.status = 'WAITING_FOR_SPACE';
                this.emit('error', 'Insufficient disk space'); // Special handling needed in Manager
                this.emitProgress();
                return;
            }

            // 3. Strategy Selection
            if (acceptRanges === 'bytes' && this.totalSize > 0) {
                await this.prepareChunks();
            } else {
                // Fallback or Single Stream
                this.chunks = [{ start: 0, end: this.totalSize - 1, tempFile: path.join(this.tempDir, 'chunk-0'), downloaded: 0, done: false }];
            }

            this.emit('ready');

        } catch (error) {
            const err = error as Error;
            this.status = 'ERROR';
            this.emit('error', err.message);
            this.emitProgress();
        }
    }

    private async prepareChunks() {
        // Tiered Logic
        let chunkCount = 3;
        if (this.totalSize < 100 * 1024 * 1024) { // < 100 MB
            chunkCount = 3;
        } else if (this.totalSize < 1024 * 1024 * 1024) { // < 1 GB
            chunkCount = 10;
        } else if (this.totalSize < 30 * 1024 * 1024 * 1024) { // < 30 GB
            chunkCount = 50;
        } else {
            // > 30 GB: RAM based
            const freeMem = os.freemem();
            const calculated = Math.floor(freeMem / RAM_CHUNK_OVERHEAD);
            chunkCount = Math.min(Math.max(calculated, 50), 128); // Cap at 128
        }

        const chunkSize = Math.ceil(this.totalSize / chunkCount);

        if (!fs.existsSync(this.tempDir)) await fs.promises.mkdir(this.tempDir);

        this.chunks = [];
        for (let i = 0; i < chunkCount; i++) {
            const start = i * chunkSize;
            const end = Math.min(start + chunkSize - 1, this.totalSize - 1);
            this.chunks.push({
                start,
                end,
                tempFile: path.join(this.tempDir, `chunk-${i}`),
                downloaded: 0,
                done: false
            });
        }
    }

    public async start() {
        this.status = 'DOWNLOADING';
        this.emitProgress();
        this.startSpeedTracking();

        // Only create new abort controllers if they don't exist or were cleared
        if (this.abortControllers.length === 0) {
            this.abortControllers = this.chunks.map(() => new AbortController());
        }

        try {
            const promises = this.chunks.map((chunk, index) => this.downloadChunk(chunk, index));
            await Promise.all(promises);
            this.stopSpeedTracking();

            await this.mergeFiles();
            await this.verifyChecksum();

            this.status = 'COMPLETED';
            this.emit('complete');
            this.emitProgress();

            // Cleanup
            await fs.promises.rm(this.tempDir, { recursive: true, force: true });

        } catch (error) {
            this.stopSpeedTracking();
            const err = error as Error;
            // TS mitigation: Cast status to check runtime value modified by async pause()
            if (err.name === 'CanceledError' || (this.status as string) === 'PAUSED') {
                // Handled
            } else {
                console.error(err);
                this.status = 'ERROR';
                this.emit('error', err);
            }
            this.emitProgress();
        }
    }

    private async downloadChunk(chunk: Chunk, index: number) {
        if (chunk.done) return;

        // Verify actual downloaded bytes from disk (don't trust memory)
        if (fs.existsSync(chunk.tempFile)) {
            const stats = fs.statSync(chunk.tempFile);
            const actualBytesOnDisk = stats.size;

            // If memory doesn't match disk, trust disk
            if (chunk.downloaded !== actualBytesOnDisk) {
                const difference = actualBytesOnDisk - chunk.downloaded;
                chunk.downloaded = actualBytesOnDisk;
                this.downloadedSize += difference;
            }
        } else {
            // File doesn't exist, reset to 0
            if (chunk.downloaded !== 0) {
                this.downloadedSize -= chunk.downloaded;
                chunk.downloaded = 0;
            }
        }

        // Check existing progress (resuming)
        const startByte = chunk.start + chunk.downloaded;
        if (startByte > chunk.end) {
            chunk.done = true;
            return;
        }

        const controller = this.abortControllers[index];
        const maxBytes = chunk.end - startByte + 1; // Maximum bytes this chunk should download

        try {
            const response = await axios.get(this.url, {
                headers: { Range: `bytes=${startByte}-${chunk.end}` },
                responseType: 'stream',
                signal: controller.signal
            });

            const writer = fs.createWriteStream(chunk.tempFile, { flags: 'a' }); // Append for resume
            let bytesWritten = 0;

            // Enforce byte limit - stop when chunk is full
            response.data.on('data', (c: Buffer) => {
                const remainingBytes = maxBytes - bytesWritten;

                if (remainingBytes <= 0) {
                    // Chunk is full, stop the stream
                    response.data.destroy();
                    writer.end();
                    return;
                }

                // Only write up to the remaining bytes for this chunk
                const bytesToWrite = Math.min(c.length, remainingBytes);
                const bufferToWrite = bytesToWrite < c.length ? c.slice(0, bytesToWrite) : c;

                writer.write(bufferToWrite);
                bytesWritten += bytesToWrite;
                chunk.downloaded += bytesToWrite;
                this.downloadedSize += bytesToWrite;
            });

            await new Promise((resolve, reject) => {
                writer.on('finish', () => resolve(true));
                writer.on('error', (e) => reject(e));
                response.data.on('end', () => {
                    writer.end();
                });
                response.data.on('error', (e: Error) => {
                    writer.end();
                    reject(e);
                });
            });

            chunk.done = true;
        } catch (error) {
            // Don't mark as done if download failed
            chunk.done = false;
            throw error; // Re-throw to be caught by start()
        }
    }

    public pause() {
        this.status = 'PAUSED';
        this.stopSpeedTracking();
        this.abortControllers.forEach(c => c.abort());
        this.emitProgress();
    }

    public resume() {
        if (this.status !== 'PAUSED' && this.status !== 'ERROR' && this.status !== 'WAITING_FOR_SPACE') return;
        // Reinitialize abort controllers for resume
        this.abortControllers = [];
        this.start();
    }

    private async mergeFiles() {
        // Ensure savedPath is a complete file path with a filename
        if (!this.originalFilename) {
            throw new Error('Cannot merge: filename not initialized');
        }

        // Check if savedPath contains the filename (not just a directory)
        const basename = path.basename(this.savedPath);
        if (!basename || basename === '.' || basename === this.savedPath) {
            throw new Error('Cannot merge: savedPath does not include a filename');
        }

        // Validate all chunks are actually done and files exist
        for (const chunk of this.chunks) {
            if (!chunk.done) {
                throw new Error('Cannot merge: not all chunks are complete');
            }
            if (!fs.existsSync(chunk.tempFile)) {
                throw new Error(`Cannot merge: chunk file ${chunk.tempFile} does not exist`);
            }
            const stats = fs.statSync(chunk.tempFile);
            const expectedSize = chunk.end - chunk.start + 1;
            if (stats.size === 0 && expectedSize > 0) {
                throw new Error(`Cannot merge: chunk file ${chunk.tempFile} is empty`);
            }
        }

        const dest = fs.createWriteStream(this.savedPath);
        for (const chunk of this.chunks) {
            const content = fs.createReadStream(chunk.tempFile);
            await new Promise((resolve, reject) => {
                content.pipe(dest, { end: false });
                content.on('end', () => resolve(true));
                content.on('error', (e) => reject(e));
            });
        }
        dest.end();
    }

    private async verifyChecksum() {
        if (!this.userHash) return; // Optional

        // Ensure savedPath is a valid file path
        if (!this.originalFilename || !fs.existsSync(this.savedPath)) {
            throw new Error('Cannot verify checksum: invalid or missing file path');
        }

        const hash = crypto.createHash('sha256');
        const input = fs.createReadStream(this.savedPath);
        await new Promise((resolve, reject) => {
            input.on('data', d => hash.update(d));
            input.on('end', () => resolve(true));
            input.on('error', (e) => reject(e));
        });
        const fileHash = hash.digest('hex');
        if (fileHash !== this.userHash) {
            this.emit('warning', 'Checksum mismatch');
        }
    }

    public setUserHash(hash: string) {
        this.userHash = hash;
    }
}
