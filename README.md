# @notibase/node

Official Node.js SDK for [Notibase](https://notibase.com) — messaging
infrastructure for developers. Web + mobile push through one idempotent API.

```bash
npm install @notibase/node
```

```ts
import { Notibase } from "@notibase/node";

const nb = new Notibase(process.env.NOTIBASE_KEY); // sk_live_...

// Send (idempotent by default — retries can never double-notify)
const { id, report } = await nb.messages.send({
  audience: { filter: { attr: "country", op: "in", value: ["NP", "IN"] } },
  content: { title: "Hello {{first_name | default: 'there'}} 👋", url: "https://…" },
});

// Debug any send: per-device timeline with raw provider responses
const { deliveries } = await nb.messages.deliveries(id);

// Profiles & targeting
await nb.users.upsert({ external_id: "user-42", country: "NP", properties: { plan: "pro" } });
const { count } = await nb.segments.preview({ attr: "properties.plan", op: "eq", value: "pro" });
```

## Identity verification

Stop anyone from impersonating your users with the public client key:

```ts
import { signIdentify } from "@notibase/node";
// on YOUR server:
const signature = signIdentify(process.env.NOTIBASE_IDENTIFY_SECRET, userId);
// hand `signature` to your frontend → nb.identify(userId, { signature })
```

Server keys (`sk_*`) belong on servers only. The constructor refuses client
keys (`ck_*`) — those go in browsers/apps with `@notibase/web`.

MIT © Notibase
