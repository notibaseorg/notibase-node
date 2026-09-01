# @notibase/node

Official Node.js SDK for [Notibase](https://notibase.com). Send push
notifications to the web, iOS and Android, plus email and SMS, to one
audience through one idempotent API.

```bash
npm install @notibase/node
```

## Coming from OneSignal, or straight from Firebase

Notibase is an alternative to OneSignal, and the device-side model is the
same shape: register a token, identify the person behind it, tag them, send
to a segment. Most of a port is renaming calls. What is arranged differently
is that push, in-app messages, an in-app inbox, email and SMS are one
audience and one API here rather than several products with separate lists.

It is not an alternative to Firebase Cloud Messaging, and does not try to
be. On Android you keep `firebase_messaging` and hand us the token: FCM
delivers, and Notibase decides who to deliver to — then carries the same
campaign to iOS, the web, an inbox, an email and a text without you writing
any of it a second time.

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

// Events only your backend knows about — the ones worth automating on,
// and the ones a client cannot be trusted to report.
await nb.events.track({ name: "payment_settled", properties: { plan: "pro" } });

// "9 AM wherever they are." One scheduled job per UTC offset your audience
// keeps, so the cost is bounded by the world's clocks and not by your list.
const r = await nb.messages.send({
  audience: { all: true },
  content: { title: "Good morning" },
  localTime: "09:00",
});
r.zone_groups;      // how many jobs
r.groups_tomorrow;  // zones whose 09:00 has gone, so they run tomorrow
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

## Changelog

[CHANGELOG.md](./CHANGELOG.md).

MIT © Notibase
