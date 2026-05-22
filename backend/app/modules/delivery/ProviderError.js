export class ProviderError extends Error {
  constructor(code, message, cause) {
    super(message || code);
    this.name = "ProviderError";
    this.code = code || "PROVIDER_ERROR";
    this.cause = cause;
    this.statusCode = 502;
  }
}

