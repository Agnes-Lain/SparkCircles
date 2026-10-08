# SparkCircles API

Rails 8.1 API-only backend. Setup decisions: [`docs/api/backend-setup-proposal.md`](../docs/api/backend-setup-proposal.md).

## Requirements

- Ruby 4.0.7 (rbenv, see `.ruby-version`)
- libvips (`brew install vips`): strips metadata from ID photos before they are stored
- PostgreSQL 18 on port **5433** (`brew install postgresql@18`, `port = 5433` in `/opt/homebrew/var/postgresql@18/postgresql.conf`, `brew services start postgresql@18`)

On this Mac, native gems (`pg`, `bcrypt`, …) only compile with:

```bash
export DEVELOPER_DIR=/Library/Developer/CommandLineTools
export SDKROOT=/Library/Developer/CommandLineTools/SDKs/MacOSX.sdk   # MacOSX27.0 SDK breaks the linker
export PATH="/opt/homebrew/opt/postgresql@18/bin:$PATH"             # pg_dump 18 writes db/structure.sql
```

## Setup

```bash
bin/setup --skip-server   # bundle install + db:prepare
bin/rails server
```

Health check: `GET /up` returns 200.

Development data: `bin/rails db:seed` creates an admin, a verified parent and a parent with a pending
verification (`admin@`, `verified@` and `pending@sparkcircles.localhost`). No password is stored in
the repository: choose one with `SEED_PASSWORD='…' bin/rails db:seed`, or leave it out and the seed
prints a generated password once at the end (keep it in your password manager). Accounts that already
exist keep their current password. The back office is at http://localhost:3000/admin;
the first login asks to connect an authenticator app.

Emails are not sent in development: they are kept in `tmp/letter_opener` and listed at
http://localhost:3000/letter_opener (gem `letter_opener_web`, development group only, never mounted in test or
production). From the iPhone, use `http://<Mac Wi-Fi address>:3000/letter_opener` with the server started on
`-b 0.0.0.0`: anyone on your Wi-Fi can read them while it runs, like the rest of the development API. Links in
them are normal http links, `http://<Mac LAN IP>:3000/dev/open-app/<path>?token=…`: that development-only page
(`Dev::OpenAppController`, never drawn in test or production) redirects to Expo Go at
`exp://<Mac LAN IP>:8081/--/<path>?token=…`, with an "Ouvrir dans Expo Go / Open in Expo Go" link as a fallback.
It only accepts the paths the app opens from emails (`confirm-email`, `reset-password`, `this-wasnt-me`,
`forgot-password`), otherwise 404. iOS ignores taps on `exp://` links inside letter_opener's frames, hence this
hop. Set `APP_LINK_BASE` to change the email link base (see
[`mobile/README.md`](../mobile/README.md), "Try the account screens on the iPhone"). Templates can also be
previewed at http://localhost:3000/rails/mailers (`?locale=en` or `?locale=fr`).

### Testing on a phone (development only)

The iPhone (Expo Go) reaches the API over your Wi-Fi, so start the server on every network interface:

```bash
bin/rails server -b 0.0.0.0
```

- Development only, on your home Wi-Fi: while it runs, other devices on the same network can reach
  the development API. Don't do it on public or office Wi-Fi.
- The first time, macOS asks whether `ruby` may accept incoming connections: allow it.
- No other change is needed: Rails accepts IP addresses as host in development, and native apps
  don't use CORS. The app side is in [`mobile/README.md`](../mobile/README.md).
- The Android emulator doesn't need it: it reaches `bin/rails server` at `http://10.0.2.2:3000`.

First admin in production: `bin/rails admin:grant EMAIL=...` on a confirmed account; later admins are
given the role in the back office.

## Secrets (never committed)

| What | Where |
|---|---|
| `config/master.key` | Decrypts `config/credentials.yml.enc` (`secret_key_base`). Only on the PM's Mac, keep a copy in a password manager. |
| `config/credentials/development.key` | Decrypts development credentials (Active Record Encryption keys for development). Only on the PM's Mac. |
| Production encryption keys | Environment variables `ACTIVE_RECORD_ENCRYPTION_PRIMARY_KEY`, `ACTIVE_RECORD_ENCRYPTION_DETERMINISTIC_KEY`, `ACTIVE_RECORD_ENCRYPTION_KEY_DERIVATION_SALT`, generated with `bin/rails db:encryption:init` and stored in the host's secret manager. |

Losing the production encryption keys means losing the encrypted data: store them in two safe places.

## Feature switches

| Env var | Default | Effect |
|---|---|---|
| `DROPOFF_ENABLED` | off | `true` turns drop-off events (accompanying adult optional) on. Off: none can be created or published, and existing ones are visible only to their host and accepted participants. |

## Checks

```bash
bundle exec rspec
bundle exec rubocop
bin/brakeman --no-pager
bundle exec bundler-audit check --update
bin/ci                    # all of the above
```

Specs never contain password literals: use the helpers in `spec/support/test_passwords.rb`
(`strong_test_password`, `wrong_test_password`, `new_test_password`, `short_test_password`,
`common_test_password`), which generate values at run time or read them from `config/common_passwords.txt`.
