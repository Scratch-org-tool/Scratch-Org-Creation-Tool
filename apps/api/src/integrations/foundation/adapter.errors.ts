export type IntegrationErrorCode =
  | 'not_connected'
  | 'authentication_failed'
  | 'authorization_failed'
  | 'not_found'
  | 'rate_limited'
  | 'invalid_request'
  | 'unsupported_capability'
  | 'provider_unavailable'
  | 'adapter_not_registered';

export class IntegrationError extends Error {
  constructor(
    public readonly code: IntegrationErrorCode,
    message: string,
    public readonly options: {
      provider?: string;
      retryable?: boolean;
      statusCode?: number;
      cause?: unknown;
    } = {},
  ) {
    super(message);
    this.name = 'IntegrationError';
  }
}

export class AdapterNotRegisteredError extends IntegrationError {
  constructor(provider: string) {
    super('adapter_not_registered', `No integration adapter is registered for "${provider}"`, {
      provider,
      retryable: false,
    });
    this.name = 'AdapterNotRegisteredError';
  }
}
