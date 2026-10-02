# SPARKCIRCLES API

Rails 8.1 API-only backend. Setup decisions: [`docs/api/backend-setup-proposal.md`](../docs/api/backend-setup-proposal.md).

## Requirements

- Ruby 4.0.7 (rbenv, see `.ruby-version`)
- PostgreSQL 18 on port **5433** (`brew install postgresql@18`, `port = 5433` in `/opt/homebrew/var/postgresql@18/postgresql.conf`, `brew services start postgresql@18`)

On this Mac, native gems (`pg`, `bcrypt`, …) only compile with:

```bash
export DEVELOPER_DIR=/Library/Developer/CommandLineTools
export SDKROOT=/Library/Developer/CommandLineTools/SDKs/MacOSX.sdk   # MacOSX27.0 SDK breaks the linker
```

## Setup

```bash
bin/setup --skip-server   # bundle install + db:prepare
bin/rails server
```

Health check: `GET /up` returns 200.

## Secrets (never committed)

| What | Where |
|---|---|
| `config/master.key` | Decrypts `config/credentials.yml.enc` (`secret_key_base`). Only on the PM's Mac, keep a copy in a password manager. |
| `config/credentials/development.key` | Decrypts development credentials (Active Record Encryption keys for development). Only on the PM's Mac. |
| Production encryption keys | Environment variables `ACTIVE_RECORD_ENCRYPTION_PRIMARY_KEY`, `ACTIVE_RECORD_ENCRYPTION_DETERMINISTIC_KEY`, `ACTIVE_RECORD_ENCRYPTION_KEY_DERIVATION_SALT`, generated with `bin/rails db:encryption:init` and stored in the host's secret manager. |

Losing the production encryption keys means losing the encrypted data: store them in two safe places.

## Checks

```bash
bundle exec rspec
bundle exec rubocop
bin/brakeman --no-pager
bundle exec bundler-audit check --update
bin/ci                    # all of the above
```
