// Gemini API Types
export interface GeminiRequest {
  contents: GeminiContent[];
  tools?: GeminiTool[];
  toolConfig?: GeminiToolConfig;
  safetySettings?: GeminiSafetySetting[];
  systemInstruction?: GeminiContent;
  generationConfig?: GeminiGenerationConfig;
}

export interface GeminiContent {
  role: "user" | "model";
  parts: GeminiPart[];
}

export interface GeminiPart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string; // base64 encoded
  };
  functionCall?: {
    name: string;
    args: Record<string, any>;
  };
  functionResponse?: {
    name: string;
    response: Record<string, any>;
  };
  fileData?: {
    mimeType: string;
    fileUri: string;
  };
}

export interface GeminiTool {
  functionDeclarations: GeminiFunctionDeclaration[];
}

export interface GeminiFunctionDeclaration {
  name: string;
  description?: string;
  parameters?: {
    type: "object";
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface GeminiToolConfig {
  functionCallingConfig: {
    mode: "AUTO" | "ANY" | "NONE";
    allowedFunctionNames?: string[];
  };
}

export interface GeminiSafetySetting {
  category: string;
  threshold: string;
}

export interface GeminiGenerationConfig {
  temperature?: number;
  topP?: number;
  topK?: number;
  candidateCount?: number;
  maxOutputTokens?: number;
  stopSequences?: string[];
  responseMimeType?: string;
  responseSchema?: Record<string, any>;
}

// Response types
export interface GeminiResponse {
  candidates?: GeminiCandidate[];
  promptFeedback?: GeminiPromptFeedback;
  usageMetadata?: GeminiUsageMetadata;
}

export interface GeminiCandidate {
  content?: GeminiContent;
  finishReason?: "STOP" | "MAX_TOKENS" | "SAFETY" | "RECITATION" | "OTHER" | "BLOCKLIST" | "PROHIBITED_CONTENT" | "SPII" | "MALFORMED_FUNCTION_CALL";
  index?: number;
  safetyRatings?: GeminiSafetyRating[];
  citationMetadata?: GeminiCitationMetadata;
  tokenCount?: number;
}

export interface GeminiPromptFeedback {
  blockReason?: string;
  safetyRatings?: GeminiSafetyRating[];
}

export interface GeminiSafetyRating {
  category: string;
  probability: string;
  blocked?: boolean;
}

export interface GeminiCitationMetadata {
  citationSources?: GeminiCitationSource[];
}

export interface GeminiCitationSource {
  startIndex?: number;
  endIndex?: number;
  uri?: string;
  license?: string;
}

export interface GeminiUsageMetadata {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
}

// Model listing types
export interface GeminiModel {
  name: string;
  baseModelId?: string;
  version: string;
  displayName: string;
  description: string;
  inputTokenLimit: number;
  outputTokenLimit: number;
  supportedGenerationMethods: string[];
  temperature?: number;
  maxTemperature?: number;
  topP?: number;
  topK?: number;
}

export interface GeminiModelsResponse {
  models: GeminiModel[];
  nextPageToken?: string;
}

// Error types
export interface GeminiError {
  error: {
    code: number;
    message: string;
    status: string;
    details?: any[];
  };
}
