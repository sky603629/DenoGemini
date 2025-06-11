import { GeminiModelsResponse, GeminiModel } from "../types/gemini.ts";
import { configManager, logger } from "../config/env.ts";

export interface OpenAIModel {
  id: string;
  object: "model";
  created: number;
  owned_by: string;
}

export interface OpenAIModelsResponse {
  object: "list";
  data: OpenAIModel[];
}

class ModelService {
  private models: GeminiModel[] = [];
  private lastFetch = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5分钟

  async getAvailableModels(forceRefresh = false): Promise<GeminiModel[]> {
    const now = Date.now();

    if (!forceRefresh && this.models.length > 0 && (now - this.lastFetch) < this.CACHE_DURATION) {
      return this.models;
    }

    // 检查是否配置了API密钥
    if (!configManager.hasGeminiKeys()) {
      logger.warn("未配置Gemini API密钥，返回空模型列表");
      return [];
    }

    try {
      const apiKey = configManager.getNextApiKey();
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`获取模型失败: ${response.status} ${response.statusText}`);
      }

      const data: GeminiModelsResponse = await response.json();

      // 过滤支持generateContent的模型
      this.models = data.models.filter(model =>
        model.supportedGenerationMethods.includes("generateContent")
      );

      this.lastFetch = now;
      logger.info(`已获取 ${this.models.length} 个可用的Gemini模型`);

      return this.models;
    } catch (error) {
      logger.error("获取Gemini模型失败:", error);

      // 如果有缓存模型则返回，否则返回空数组
      if (this.models.length > 0) {
        logger.warn("由于获取错误，使用缓存的模型");
        return this.models;
      }

      return [];
    }
  }

  async isValidModel(modelName: string): Promise<boolean> {
    const models = await this.getAvailableModels();
    return models.some(model => 
      model.name === modelName || 
      model.name === `models/${modelName}` ||
      model.displayName === modelName
    );
  }

  normalizeModelName(modelName: string): string {
    // 如果模型名称不以"models/"开头，则添加它
    if (!modelName.startsWith("models/")) {
      return `models/${modelName}`;
    }
    return modelName;
  }

  async getOpenAICompatibleModels(): Promise<OpenAIModelsResponse> {
    const geminiModels = await this.getAvailableModels();

    const openaiModels: OpenAIModel[] = geminiModels.map(model => ({
      id: model.name.replace("models/", ""), // 移除"models/"前缀以兼容OpenAI
      object: "model",
      created: Math.floor(Date.now() / 1000),
      owned_by: "google",
    }));

    return {
      object: "list",
      data: openaiModels,
    };
  }

  getModelDisplayName(modelName: string): string {
    const normalizedName = this.normalizeModelName(modelName);
    const model = this.models.find(m => m.name === normalizedName);
    return model?.displayName || modelName;
  }

  getModelLimits(modelName: string): { inputTokenLimit: number; outputTokenLimit: number } {
    const normalizedName = this.normalizeModelName(modelName);
    const model = this.models.find(m => m.name === normalizedName);
    
    return {
      inputTokenLimit: model?.inputTokenLimit || 32768,
      outputTokenLimit: model?.outputTokenLimit || 8192,
    };
  }
}

export const modelService = new ModelService();
