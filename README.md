# @umami/migrate-v1-v2

Script for migrating data from Umami v1 to v2.

## Getting started

Please backup your target database prior to use.

## Configure umami

Create an `.env` file with the following

```
DATABASE_URL=connection-url
```

The connection url is in the following format:

```
postgresql://username:mypassword@localhost:5432/mydb

mysql://username:mypassword@localhost:3306/mydb
```

## Usage

```shell
npx @umami/migrate-v1-v2
```