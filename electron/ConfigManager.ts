import path from 'node:path';
import fs from 'node:fs';
import { app } from 'electron';

export interface AppConfig {
  defaultDownloadPath: string;
  maxConcurrentDownloads: number;
  maxChunks: number;
  theme: 'light' | 'dark' | 'system';
}

const DEFAULT_CONFIG: AppConfig = {
  defaultDownloadPath: app.getPath('downloads'),
  maxConcurrentDownloads: 3,
  maxChunks: 8,
  theme: 'system',
};

class ConfigManager {
  private configPath: string;
  private config: AppConfig;

  constructor() {
    this.configPath = path.join(app.getPath('userData'), 'config.json');
    this.config = this.loadConfig();
  }

  private loadConfig(): AppConfig {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf-8');
        return { ...DEFAULT_CONFIG, ...JSON.parse(data) };
      }
    } catch (error) {
      console.error('Failed to load config:', error);
    }
    return { ...DEFAULT_CONFIG };
  }

  private saveConfig(): void {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
    } catch (error) {
      console.error('Failed to save config:', error);
    }
  }

  public get<K extends keyof AppConfig>(key: K): AppConfig[K] {
    return this.config[key];
  }

  public getAll(): AppConfig {
    return { ...this.config };
  }

  public set<K extends keyof AppConfig>(key: K, value: AppConfig[K]): void {
    this.config[key] = value;
    this.saveConfig();
  }
}

export const configManager = new ConfigManager();
