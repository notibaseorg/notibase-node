# @notibase/node

## 0.4.0

- **`report.sent` is zero on the response to a send, and that is not a bug.**
  The API now accepts a campaign, writes its recipients down and answers,
  instead of holding the request open until the last device has been
  written to — so a send to forty thousand people costs the same call as a
  send to four, and your request no longer inherits the length of the
  campaign. Nothing has been attempted by the time it returns, so `sent`
  and `failed` are zero by definition. `accepted` and `skipped` are still
  final, because both are decided before anything is tried.

  **If you branched on `report.sent`, that code is already reading zero** —
  the change is server-side and reached you without an upgrade. Read the
  outcome from `messages.deliveries(id)` instead, which is what it is for.
- `SendResult.status` is `"sending"` for an immediate send and
  `"scheduled"` for a future one. It was `"sent"`, which promised something
  the call had never been in a position to promise.
- `SendReport.queued` — of the people a campaign was accepted for, how many
  a provider will actually be asked about.

## 0.3.0

- `users.export(externalId)` and `users.erase(externalId)` — the two halves of
  a data-subject request, wired to the buttons in your own product rather than
  answered by hand. `erase` is idempotent, so a delete-my-account flow can
  retry. See https://notibase.dev/data.html for exactly what erasure removes
  and what it deliberately keeps.
- `users.upsert` accepts `birthdate`. The date, never an age: `age` is derived
  from it when a filter runs, so it is right on the day it is read.
- `messages.send` accepts `name`, `sendAtLocal`, `timezone` and `localTime`.
  The API has taken all four for some time and this SDK could reach none of
  them, so scheduling a campaign for "5 PM in Kathmandu" from Node meant
  computing an instant yourself — which is the mistake `send_at_local` exists
  to prevent.
- `devices.unsubscribe` accepts `email` and `phone`, and
  `devices.resubscribe` accepts any channel this deployment runs. The latter
  was typed as the three push channels, so an email address suppressed by a
  mis-imported opt-out could be lifted from the console and from curl but
  never from here.

## 0.2.0

Sends, users, segments, devices and identity verification.
