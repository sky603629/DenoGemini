// OpenAI API Types
export interface OpenAIMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | OpenAIContentPart[] | null;
  name?: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface OpenAIContentPart {
  type: "text" | "image_url";
  text?: string;
  image_url?: {
    url: string;
    detail?: "auto" | "low" | "high";
  };
}

export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface OpenAITool {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, any>;
  };
}

export interface OpenAIRequest {
  model: string;
  messages: OpenAIMessage[];
  temperature?: number;
  top_p?: number;
  n?: number;
  stream?: boolean;
  stop?: string | string[];
  max_tokens?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
  logit_bias?: Record<string, number>;
  user?: string;
  tools?: OpenAITool[];
  tool_choice?: "none" | "auto" | "required" | { type: "function"; function: { name: string } };
  response_format?: { type: "text" | "json_object" };
  seed?: number;
  logprobs?: boolean;
  top_logprobs?: number;
  // Non-standard extensions (like SiliconFlow's reasoning)
  thinking_budget?: number;
  // 思考模型控制参数
  enable_thinking?: boolean;
}

export interface OpenAIResponse {
  id: string;
  object: "chat.completion";
  created: number;
  model: string;
  choices: OpenAIChoice[];
  usage?: OpenAIUsage;
  system_fingerprint?: string;
}

export interface OpenAIChoice {
  index: number;
  message: OpenAIMessage;
  finish_reason: "stop" | "length" | "tool_calls" | "content_filter" | null;
  logprobs?: any;
}

export interface OpenAIUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

// Streaming types
export interface OpenAIStreamChunk {
  id: string;
  object: "chat.completion.chunk";
  created: number;
  model: string;
  choices: OpenAIStreamChoice[];
  usage?: OpenAIUsage;
  system_fingerprint?: string;
}

export interface OpenAIStreamChoice {
  index: number;
  delta: Delta;
  finish_reason: "stop" | "length" | "tool_calls" | "content_filter" | null;
  logprobs?: any;
}

export interface Delta {
  role?: "assistant" | "tool";
  content?: string;
  tool_calls?: ToolCallDelta[];
  // Non-standard extension for reasoning
  reasoning_content?: string;
}

export interface ToolCallDelta {
  index?: number;
  id?: string;
  type?: "function";
  function?: {
    name?: string;
    arguments?: string;
  };
}

// Error response
export interface OpenAIError {
  error: {
    message: string;
    type: string;
    param?: string;
    code?: string;
  };
}
