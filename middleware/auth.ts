import { configManager, logger } from "../config/env.ts";

export interface AuthResult {
  success: boolean;
  error?: {
    message: string;
    type: string;
    code?: string;
  };
}

/**
 * 从请求中提取API密钥
 * 支持多种格式：
 * 1. Authorization: Bearer <key>
 * 2. Authorization: <key>
 * 3. x-api-key: <key>
 */
function extractApiKey(request: Request): string | null {
  const headers = request.headers;
  
  // 方法1: Authorization header with Bearer
  const authHeader = headers.get("Authorization");
  if (authHeader) {
    if (authHeader.startsWith("Bearer ")) {
      return authHeader.slice(7).trim();
    } else {
      // 方法2: Authorization header without Bearer
      return authHeader.trim();
    }
  }
  
  // 方法3: x-api-key header
  const apiKeyHeader = headers.get("x-api-key");
  if (apiKeyHeader) {
    return apiKeyHeader.trim();
  }
  
  return null;
}

/**
 * 验证请求的身份
 */
export function authenticateRequest(request: Request): AuthResult {
  try {
    const providedKey = extractApiKey(request);
    
    if (!providedKey) {
      logger.warn("请求缺少API密钥");
      return {
        success: false,
        error: {
          message: "缺少API密钥。请在Authorization header中提供Bearer token或使用x-api-key header。",
          type: "authentication_error",
          code: "missing_api_key"
        }
      };
    }
    
    const isValid = configManager.validateAccessKey(providedKey);
    
    if (!isValid) {
      logger.warn(`无效的API密钥: ${providedKey.slice(0, 8)}...`);
      return {
        success: false,
        error: {
          message: "无效的API密钥。请检查您的密钥是否正确。",
          type: "authentication_error",
          code: "invalid_api_key"
        }
      };
    }
    
    logger.debug(`API密钥验证成功: ${providedKey.slice(0, 8)}...`);
    return { success: true };
    
  } catch (error) {
    logger.error("身份验证过程中出错:", error);
    return {
      success: false,
      error: {
        message: "身份验证失败",
        type: "authentication_error",
        code: "auth_error"
      }
    };
  }
}

/**
 * 创建身份验证错误响应
 */
export function createAuthErrorResponse(authResult: AuthResult): Response {
  const headers = {
    "Content-Type": "application/json",
    "WWW-Authenticate": "Bearer"
  };
  
  return new Response(
    JSON.stringify({ error: authResult.error }),
    {
      status: 401,
      headers: headers
    }
  );
}
