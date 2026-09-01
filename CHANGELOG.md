# @notibase/node

## 0.6.0

- **`events.track()` and `events.trackMany()`.** `POST /v1/events` has
  accepted a server key since it was written and this SDK had no way to call
  it, so the events only a backend knows about — a payment settled, a shipment
  moved, a trial ended — could be reported from a browser or a handset and
  from nowhere else. Those are exactly the events worth automating on, and
  exactly the ones a client cannot be trusted to report. Up to fifty per call.
- **`localTime` actually schedules now.** It has been in this SDK's types and
  in the docs for some time, and `POST /v1/messages` had no `local_time` in
  its schema — so Zod stripped the key in silence and the campaign went out
  immediately, to everybody at once. That is the 4 AM blast the feature exists
  to prevent, answered with a `200` and a cheerful report. `SendResult` now
  also carries what a recipient-local send produces: `zone_groups`,
  `groups_tomorrow`, `first_at` and `last_at`.
- Passing `localTime` together with `sendAt` or `sendAtLocal` is refused
  rather than one of them quietly winning. They are two different schedules,
  not two spellings of one.

## 0.5.0

- `messages.send({ platforms: ["ios"] })` — send to devices on some platforms
  and not others, without the old trick of writing content for `apns` and
  leaving `fcm` empty. That trick still works and is still the right one when
  the copy differs per platform; `platforms` is for the same message going to
  one platform, which the trick could not express at all.

  Devices on the platforms you did not name are **not targets**, not skipped
  ones — a deliberate iOS-only campaign should not read as tens of thousands
  of failures in the report. Omit the field for every platform; `[]` is a
  `400` rather than a send to nobody.

  Email and SMS ignore it. Both address a person, and a person does not have
  a platform; a send restricted to iOS still emails whoever the audience
  selects.

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
