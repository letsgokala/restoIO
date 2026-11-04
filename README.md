# RestoIO

## Run with Docker

Requirements: Docker Engine and Docker Compose v2.

From the repository root:

```bash
docker compose up --build -d
docker compose run --rm backend npm run db:seed
```

Open <http://localhost:3000>. The API health endpoint is <http://localhost:4000/api/v1/health>. PostgreSQL is also published on port `55432` for local database tools. The first startup applies database migrations automatically. Run the seed command once to create the local demo restaurant and staff accounts.

The default demo password is `ChangeMe_OnlyForLocalDev_123!`; set `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` in the shell before `docker compose up` to change the platform admin seed credentials. These defaults are for local development only.

To stop the containers while keeping database data:

```bash
docker compose down
```

To remove the database and all its data too:

```bash
docker compose down -v
```

For application features, demo accounts, and API documentation, see [backend/README.md](backend/README.md).
