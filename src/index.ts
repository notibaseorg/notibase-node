/**
 * @notibase/node — official server SDK.
 *
 *   import { Notibase } from "@notibase/node";
 *   const nb = new Notibase("sk_live_...");
 *   await nb.messages.send({ audience: { all: true }, content: { title: "Hi" } });
 *
 * Server keys (sk_*) only — never ship this SDK's key to a browser or app.
 */
import { createHmac, randomUUID } from "node:crypto";

export interface NotibaseOptions {
  apiUrl?: string;
  /** fetch injection for testing/edge runtimes */
  fetch?: typeof fetch;
}

export interface Audience {
  all?: boolean;
  device_ids?: string[];
  segment_id?: string;
  /** Filter AST v1 — https://notibase.com/docs/filters */
  filter?: unknown;
}

export interface MessageContent {
  title: string;
  body?: string;
  url?: string;
  [channelOrField: string]: unknown;
}

export interface SendReport {
  /** Everyone the campaign was accepted for. Final. */
  accepted: number;
  /** Of those, how many providers will be asked about. Final. */
  queued?: number;
  /**
   * Zero on the response to a send, always: the call returns once the
   * campaign is accepted, and nothing has been attempted yet. Read the
   * real ones from `messages.deliveries(id)` afterwards.
   */
  sent: number;
  failed: number;
  /** Refused before anything was attempted — suppressed, over quota, no
   *  content for that channel. Final. */
  skipped: number;
}

export interface SendResult {
  id: string;
  /**
   * `"sending"` for an immediate send, `"scheduled"` for a future one.
   *
   * "sending" is not a hedge: the API accepts the campaign, writes its
   * recipients down and answers, so this call costs the same for forty
   * thousand people as for four and your request does not inherit the
   * campaign's length. Whether each notification arrived is what
   * `messages.deliveries()` is for.
   */
  status: string;
  replayed: boolean;
  report?: SendReport;
}

export interface Delivery {
  device_id: string | null;
  channel: string;
  event: string;
  error_code: string | null;
  raw: unknown;
  ts: string;
}

export class NotibaseError extends Error {
  constructor(
    public status: number,
    public body: string,
    public path: string
  ) {
    super(`notibase ${path} → ${status}: ${body.slice(0, 300)}`);
    this.name = "NotibaseError";
  }
}

export class Notibase {
  private apiUrl: string;
  private fetchImpl: typeof fetch;

  constructor(private serverKey: string, opts: NotibaseOptions = {}) {
    if (!serverKey.startsWith("sk_")) {
      throw new Error(
        serverKey.startsWith("ck_")
          ? "That's a client key (ck_) — the Node SDK needs a server key (sk_). Client keys go in browsers/apps."
          : "Notibase server keys start with sk_live_ or sk_test_."
      );
    }
    this.apiUrl = (opts.apiUrl ?? "https://api.notibase.com").replace(/\/$/, "");
    this.fetchImpl = opts.fetch ?? fetch;
  }

  readonly messages = {
    /** Idempotent by default: a UUID key is generated unless you pass one.
     *  Pass sendAt (Date or ISO string) to schedule instead of sending now. */
    send: (
      params: {
        audience: Audience;
        content: MessageContent;
        idempotencyKey?: string;
        /** An instant you have already worked out. */
        sendAt?: Date | string;
        /**
         * A wall-clock time — `"2026-08-25T17:00"`, no `Z`, no offset —
         * resolved against `timezone`, or the app's zone if you omit it.
         *
         * Prefer this to `sendAt` whenever a person typed the time. "5 PM"
         * is not an instant until you say where, and an instant computed on
         * a laptop in another country is a campaign that quietly moved.
         * https://notibase.dev/scheduling.html
         */
        sendAtLocal?: string;
        /** IANA name for `sendAtLocal`. An offset like `+05:45` is refused. */
        timezone?: string;
        /** The same local hour in every recipient's own zone. Paid plans. */
        localTime?: string;
        /** Internal label. Never shown to a recipient; it names the row in Sent messages. */
        name?: string;
      }
    ): Promise<SendResult> =>
      this.request("POST", "/v1/messages", {
        body: {
          audience: params.audience,
          content: params.content,
          ...(params.name ? { name: params.name } : {}),
          ...(params.sendAt
            ? { send_at: params.sendAt instanceof Date ? params.sendAt.toISOString() : params.sendAt }
            : {}),
          ...(params.sendAtLocal ? { send_at_local: params.sendAtLocal } : {}),
          ...(params.timezone ? { timezone: params.timezone } : {}),
          ...(params.localTime ? { local_time: params.localTime } : {}),
        },
        headers: { "idempotency-key": params.idempotencyKey ?? randomUUID() },
      }),
    deliveries: (messageId: string): Promise<{ deliveries: Delivery[] }> =>
      this.request("GET", `/v1/messages/${messageId}/deliveries`),
  };

  readonly users = {
    upsert: (user: {
      external_id: string;
      first_name?: string; last_name?: string;
      /** Lower-cased on the way in. An address, not a property. */
      email?: string;
      /**
       * E.164, with the country code: `+9779812345678`. Spaces and
       * punctuation are stripped, but the country code is never guessed —
       * a national number is refused, because the failure mode is not a
       * bounce, it is a text delivered to a stranger somewhere else.
       */
      phone?: string;
      /**
       * Anything: `M`, `male`, `Male` and `MALE` all store as `male`, and
       * so do the equivalents for female, nonbinary, other and unknown.
       * A value we do not recognise is kept, slugified — `Two-Spirit`
       * stores as `two_spirit`. Filter on the stored value.
       */
      gender?: string;
      /**
       * `YYYY-MM-DD`, or an ISO timestamp whose time is dropped.
       *
       * The date, never an age — there is no `age` field to write. An age
       * written once is wrong within a year and nothing notices; `age` is
       * derived from this when a filter asks, so `{"attr":"age","op":
       * "between","value":[25,34]}` is right on the day it runs.
       * A date that does not exist (`2026-02-31`) is refused, not rounded.
       */
      birthdate?: string;
      /** ISO 3166-1 alpha-2, upper-cased. `NP`, not `Nepal`. Refused if we would have to guess. */
      country?: string;
      /** ISO 639-1, lower-cased. A browser locale works: `en-GB` stores as `en`. */
      language?: string;
      /** Free text, compared exactly. Pick one spelling and keep to it. */
      region?: string; city?: string;
      /** An IANA name — `Asia/Kathmandu`. An offset like `+05:45` is refused. */
      timezone?: string;
      /** Everything else. Filter these as `properties.<key>`. */
      properties?: Record<string, unknown>;
      device_id?: string;
      /**
       * https://notibase.dev/attributes.html — the full table of what each
       * reserved attribute accepts and what it stores.
       */
    }): Promise<{
      id: string; property_conflicts: unknown[];
      /** Values that arrived but could not be used, with the reason. */
      rejected_attributes?: { key: string; given: string; reason: string }[];
    }> =>
      this.request("POST", "/v1/users", { body: user }),

    /**
     * Everything Notibase holds about one person, for a subject access
     * request. Wire this to the "download my data" button in your own
     * product rather than answering each one by hand.
     */
    export: (externalId: string): Promise<Record<string, unknown>> =>
      this.request("GET", `/v1/users/${encodeURIComponent(externalId)}/export`),

    /**
     * Forget somebody, at their request.
     *
     * Their profile, addresses, inbox and preferences go. Delivery events
     * stay as anonymous rows so campaign totals other people are reading
     * do not change, and their devices stay and become anonymous — a
     * handset is not a person.
     *
     * The addresses are recorded as a one-way hash so a later CSV import
     * of an older list cannot bring them back. Idempotent: erasing
     * somebody already erased returns `erased: false` rather than an
     * error, because the goal is a state and a retry should not fail.
     *
     * This is not `unsubscribe()`. That is somebody who said stop; this
     * is somebody who said forget.
     */
    erase: (externalId: string): Promise<{
      erased: boolean;
      deleted: Record<string, number>;
      anonymised: Record<string, number>;
      tombstoned: number;
    }> =>
      this.request("DELETE", `/v1/users/${encodeURIComponent(externalId)}`),
  };

  readonly segments = {
    create: (params: { name: string; filter: unknown }): Promise<{ id: string }> =>
      this.request("POST", "/v1/segments", { body: params }),
    preview: (filter: unknown): Promise<{ count: number }> =>
      this.request("POST", "/v1/segments/preview", { body: { filter } }),
  };

  readonly devices = {
    list: (): Promise<{ devices: unknown[] }> => this.request("GET", "/v1/devices"),
    register: (device: { platform: "web" | "ios" | "android"; token: string; locale?: string; timezone?: string }): Promise<{ id: string }> =>
      this.request("POST", "/v1/devices", { body: device }),

    /**
     * Honour an opt-out. Suppressed addresses are skipped by every future
     * send — the check lives in the pipeline, not in your campaign logic, so
     * this cannot be forgotten at send time.
     *
     * Pass `external_id` to opt a person out across every device they have,
     * which is what an account-settings toggle usually wants.
     */
    unsubscribe: (target: {
      device_id?: string;
      /** Opt a person out across every device and address they have. */
      external_id?: string;
      /** Or by the address itself, for a list you hold and we do not. */
      email?: string;
      phone?: string;
      reason?: string;
    }): Promise<{ unsubscribed: number }> =>
      this.request("POST", "/v1/unsubscribe", { body: target }),

    /** Lift a suppression — a mis-imported opt-out, or a change of mind. */
    resubscribe: (target: {
      device_id?: string;
      /**
       * Any channel this deployment has registered — `email` and `sms`
       * included. This used to be typed as the three push channels, which
       * meant an email address suppressed by a mis-imported opt-out could
       * be lifted from the console and from curl but never from here.
       */
      channel?: string;
      address?: string;
    }): Promise<{ resubscribed: boolean }> =>
      this.request("POST", "/v1/resubscribe", { body: target }),
  };

  readonly properties = {
    list: (): Promise<{ properties: unknown[] }> => this.request("GET", "/v1/properties"),
  };

  private async request<T>(
    method: string,
    path: string,
    opts: { body?: unknown; headers?: Record<string, string> } = {}
  ): Promise<T> {
    const res = await this.fetchImpl(`${this.apiUrl}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${this.serverKey}`,
        ...(opts.body !== undefined ? { "content-type": "application/json" } : {}),
        ...opts.headers,
      },
      ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
    });
    const text = await res.text();
    if (!res.ok) throw new NotibaseError(res.status, text, path);
    return JSON.parse(text) as T;
  }
}

/**
 * Identity verification (docs: Security → Identity verification).
 * Run this on YOUR server and hand the signature to your frontend:
 *
 *   const signature = signIdentify(process.env.NOTIBASE_IDENTIFY_SECRET, userId);
 *   // frontend: nb.identify(userId, { signature })
 */
export function signIdentify(identifySecret: string, externalId: string): string {
  return createHmac("sha256", identifySecret).update(externalId).digest("hex");
}
