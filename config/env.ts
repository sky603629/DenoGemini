import { load } from "@std/dotenv";

export interface Config {
  geminiApiKeys: string[];
  accessKeys: string[];
  port: number;
  corsOrigin: string;
  logLevel: "debug" | "info" | "warn" | "error";
  maxRetries: number;
  requestTimeout: number;
}

class ConfigManager {
  private config: Config | null = null;
  private currentKeyIndex = 0;

  async loadConfig(): Promise<Config> {
    if (this.config) {
      return this.config;
    }

    // 如果存在.env文件则加载
    try {
      await load({ export: true });
    } catch (_error) {
      console.warn("未找到.env文件，仅使用环境变量");
    }

    // 解析Gemini API密钥
    const geminiKeysEnv = Deno.env.get("GEMINI_API_KEYS") || Deno.env.get("GEMINI_API_KEY") || "";
    const geminiApiKeys = geminiKeysEnv
      .split(",")
      .map(key => key.trim())
      .filter(key => key.length > 0);

    // 解析准入密码
    const accessKeysEnv = Deno.env.get("ACCESS_KEYS") || Deno.env.get("ACCESS_KEY") || "";
    const accessKeys = accessKeysEnv
      .split(",")
      .map(key => key.trim())
      .filter(key => key.length > 0);

    this.config = {
      geminiApiKeys,
      accessKeys,
      port: parseInt(Deno.env.get("PORT") || "8000"),
      corsOrigin: Deno.env.get("CORS_ORIGIN") || "*",
      logLevel: (Deno.env.get("LOG_LEVEL") as Config["logLevel"]) || "info",
      maxRetries: parseInt(Deno.env.get("MAX_RETRIES") || "3"),
      requestTimeout: parseInt(Deno.env.get("REQUEST_TIMEOUT") || "30000"),
    };

    // 输出配置状态
    if (this.config.geminiApiKeys.length === 0) {
      console.log("⚠️  未配置Gemini API密钥 - 请在Deno Deploy中设置GEMINI_API_KEYS环境变量");
    } else {
      console.log(`✅ 已加载 ${this.config.geminiApiKeys.length} 个Gemini API密钥`);
    }

    if (this.config.accessKeys.length === 0) {
      console.log("⚠️  未配置准入密码 - 请在Deno Deploy中设置ACCESS_KEYS环境变量");
    } else {
      console.log(`✅ 已加载 ${this.config.accessKeys.length} 个准入密码`);
    }

    return this.config;
  }

  getConfig(): Config {
    if (!this.config) {
      throw new Error("配置未加载。请先调用loadConfig()。");
    }
    return this.config;
  }

  // 轮询密钥选择
  getNextApiKey(): string {
    const config = this.getConfig();
    const key = config.geminiApiKeys[this.currentKeyIndex];
    this.currentKeyIndex = (this.currentKeyIndex + 1) % config.geminiApiKeys.length;
    return key;
  }

  // 根据索引获取特定密钥（用于重试逻辑）
  getApiKey(index?: number): string {
    const config = this.getConfig();
    if (index !== undefined && index >= 0 && index < config.geminiApiKeys.length) {
      return config.geminiApiKeys[index];
    }
    return this.getNextApiKey();
  }

  getApiKeyCount(): number {
    return this.getConfig().geminiApiKeys.length;
  }

  // 验证准入密码
  validateAccessKey(providedKey: string): boolean {
    const config = this.getConfig();
    return config.accessKeys.includes(providedKey);
  }

  getAccessKeyCount(): number {
    return this.getConfig().accessKeys.length;
  }

  // 检查是否已配置必需的密钥
  isConfigured(): boolean {
    const config = this.getConfig();
    return config.geminiApiKeys.length > 0 && config.accessKeys.length > 0;
  }

  // 检查Gemini API密钥是否已配置
  hasGeminiKeys(): boolean {
    return this.getConfig().geminiApiKeys.length > 0;
  }

  // 检查准入密码是否已配置
  hasAccessKeys(): boolean {
    return this.getConfig().accessKeys.length > 0;
  }

  // 获取配置状态信息
  getConfigStatus(): { configured: boolean; missingKeys: string[] } {
    const config = this.getConfig();
    const missingKeys: string[] = [];

    if (config.geminiApiKeys.length === 0) {
      missingKeys.push("GEMINI_API_KEYS");
    }

    if (config.accessKeys.length === 0) {
      missingKeys.push("ACCESS_KEYS");
    }

    return {
      configured: missingKeys.length === 0,
      missingKeys
    };
  }
}

export const configManager = new ConfigManager();

// 日志工具
export class Logger {
  private logLevel: Config["logLevel"];

  constructor(logLevel: Config["logLevel"] = "info") {
    this.logLevel = logLevel;
  }

  private shouldLog(level: Config["logLevel"]): boolean {
    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    return levels[level] >= levels[this.logLevel];
  }

  debug(message: string, ...args: unknown[]) {
    if (this.shouldLog("debug")) {
      console.log(`[调试] ${message}`, ...args);
    }
  }

  info(message: string, ...args: unknown[]) {
    if (this.shouldLog("info")) {
      console.log(`[信息] ${message}`, ...args);
    }
  }

  warn(message: string, ...args: unknown[]) {
    if (this.shouldLog("warn")) {
      console.warn(`[警告] ${message}`, ...args);
    }
  }

  error(message: string, ...args: unknown[]) {
    if (this.shouldLog("error")) {
      console.error(`[错误] ${message}`, ...args);
    }
  }
}

export const logger = new Logger();
