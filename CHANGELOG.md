# @notibase/node

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
