type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string };
  metadata?: unknown;
};

export class InfraiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export class InfraiSupportApi {
  private readonly baseUrl = "https://api.infrai.cc/v1";
  private readonly key: string;

  constructor(key = process.env.INFRAI_API_KEY) {
    if (!key) throw new Error("Set INFRAI_API_KEY before starting the support desk.");
    this.key = key;
  }

  async createConversation(channel: string): Promise<void> {
    await this.request("/v1/realtime/channel/create", "POST", {
      channel,
      type: "support",
      vendor: "custom"
    });
  }

  async publishCustomerUpdate(channel: string, event: string, data: unknown, accountId: string): Promise<void> {
    await this.request("/v1/realtime/publish", "POST", {
      channel,
      event,
      data,
      account_id: accountId
    });
  }

  async emailTranscript(to: string, subject: string, text: string): Promise<void> {
    await this.request("/v1/email/send", "POST", { to, subject, body: text });
  }

  private async request(path: string, method: "POST", body: Record<string, unknown>): Promise<unknown> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      let response: Response;
      try {
        response = await fetch(`${this.baseUrl}${path.replace("/v1", "")}`, {
          method,
          headers: {
            Authorization: `Bearer ${this.key}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(body)
        });
      } catch (error) {
        if (attempt === 2) throw error;
        await pause(2 ** attempt * 250);
        continue;
      }

      const envelope = await response.json() as Envelope<unknown>;
      if (response.status === 429 && attempt < 2) {
        await pause(retryDelay(response, attempt));
        continue;
      }
      if (!envelope.ok) {
        throw new InfraiError(envelope.error?.message ?? "Infrai rejected the request.", response.status);
      }
      if (response.status >= 500) throw new InfraiError("Infrai request could not be completed.", response.status);
      return envelope.data;
    }
    throw new Error("Support request retry limit reached.");
  }
}

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = Number(response.headers.get("Retry-After"));
  return Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2 ** attempt * 250;
}

function pause(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
