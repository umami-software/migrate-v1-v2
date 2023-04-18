# @umami/migrate-v1-v2

Script for migrating data from Umami v1 to v2.

### Requirements

- Database schema must be in sync with the latest v1 Umami repo. The script will query the prisma migrations table to ensure the latest migrations have been ran.

### Important
- Backup your target database prior to use. Potential data loss may occur if the migration is interrupted.
- For users with larger datasets (5M+), the migration may take while. Please plan accordingly.
- The script will NOT migrate any event data into v2.
- The script will ask you if you want to drop your v1 tables after the migration is complete.
- If an `event_data` table is found populated with data, it will be renamed to `v1_event_data` but not dropped.

### Install

```shell
git clone https://github.com/umami-software/migrate-v1-v2.git
cd migrate-v1-v2
yarn build
```

### Configure

Create an `.env` file with the following variable defined:

```
DATABASE_URL={connection url}
```

### Run

```shell
yarn start
```

### Troubleshooting

- If your `DATABASE_URL` is localhost and the migration can't connect to the database, try changing to an IP address, for example: `127.0.0.1`.