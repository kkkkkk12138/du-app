const AUTH_ERROR_MESSAGES: Record<string, string> = {
  invalid_code: '验证码不正确，请重新输入',
  expired_code: '验证码已过期，请重新获取',
  rate_limited: '请求过于频繁，请稍后再试',
  network: '网络连接不可用，请稍后再试',
};

function readErrorCode(error: unknown) {
  if (!error || typeof error !== 'object') {
    return undefined;
  }

  const candidate = error as {
    error?: unknown;
    code?: unknown;
    errorCode?: unknown;
  };
  const code = candidate.error ?? candidate.code ?? candidate.errorCode;
  return typeof code === 'string' ? code : undefined;
}

export function toAccountAuthError(error: unknown) {
  if (error instanceof Error && !readErrorCode(error)) {
    return error;
  }

  const code = readErrorCode(error);
  return new Error(
    (code && AUTH_ERROR_MESSAGES[code]) ??
      '登录暂时无法完成，请稍后再试',
  );
}
