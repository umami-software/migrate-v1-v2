#! /usr/bin/env node
require('dotenv').config();
const fse = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');
const prompts = require('prompts');
const { PrismaClient } = require('@prisma/client');
const { success, error, inProgress } = require('./common');

let prisma;
let databaseType;

function getDatabaseType(url = process.env.DATABASE_URL) {
  const type = process.env.DATABASE_TYPE || (url && url.split(':')[0]);

  if (type === 'postgres') {
    return 'postgresql';
  }

  return type;
}

  
async function checkEnv() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not defined.');
  } else {
    success('DATABASE_URL is defined.');
  }
}

async function checkConnection() {
  try {
    await prisma.$connect();

    success('Database connection successful.');
  } catch (e) {
    throw new Error('Unable to connect to the database:' + e.message);
  }
}

async function executeRawIgnore(sql) {
  try {
    await prisma.$executeRawUnsafe(sql);
  } catch (e) {
    // Ignore
  }
}

async function checkV1Tables() {
  try {
    await prisma.$queryRaw`select * from account limit 1`;
    const record = await prisma.$queryRaw`select * from _prisma_migrations where migration_name = '04_add_uuid' and finished_at IS NOT NULL`;

    // alter v1 tables
    if (record.length > 0) {
      console.log('Preparing v1 tables for migration');

      await dropV1Keys(databaseType);
      await dropV1Indexes(databaseType);
      await renameV1Tables(databaseType);
    }   
  } catch (e) {
    // Ignore
  }
}

async function checkV1TablesReady() {
  try {
    await prisma.$queryRaw`select * from v1_account limit 1`;

    success('Database v1 tables ready for migration.');
  } catch (e) {
    throw new Error('Database v1 tables have not been detected.');
  }
}


async function checkV2Tables() {
  try {
    await prisma.$queryRaw`select * from website_event limit 1`;

    success('Database v2 tables found.');
  } catch (e) {
    console.log('Database v2 tables not found.');
    console.log('Adding v2 tables...');

    // run v2 prisma migration steps
    await runSqlFile(`/db/${databaseType}/migrations/01_init/migration.sql`);
    console.log(execSync('npx prisma migrate resolve --applied 01_init').toString());
  }
}

async function checkMigrationReady() {
  try {
    await prisma.$queryRaw`select * from website_event limit 1`;
    await prisma.$queryRaw`select * from v1_account limit 1`;

    success('Database is ready for migration.');
  } catch (e) {
    throw new Error('Database is not ready for migration.');
  }
}

async function migrateData() {
  const filePath = `/db/${databaseType}/data-migration-v2.sql`;
  inProgress('Starting v2 data migration. Please do no cancel this process, it may take a while.');
  await runSqlFile(filePath);

  success('Data migration from V1 to V2 tables completed.');
}

async function dropV1Keys(databaseType) {
  try {
    // drop keys
    if (databaseType === 'postgresql') {
      await prisma.$transaction([
        prisma.$executeRaw`ALTER TABLE IF EXISTS _prisma_migrations DROP CONSTRAINT IF EXISTS _prisma_migrations_pkey CASCADE;`,
        prisma.$executeRaw`ALTER TABLE IF EXISTS account DROP CONSTRAINT IF EXISTS account_pkey CASCADE;`,
        prisma.$executeRaw`ALTER TABLE IF EXISTS event DROP CONSTRAINT IF EXISTS event_pkey CASCADE;`,
        prisma.$executeRaw`ALTER TABLE IF EXISTS session DROP CONSTRAINT IF EXISTS session_pkey CASCADE;`,
        prisma.$executeRaw`ALTER TABLE IF EXISTS website DROP CONSTRAINT IF EXISTS website_pkey CASCADE;`,
        prisma.$executeRaw`ALTER TABLE IF EXISTS event_data DROP CONSTRAINT IF EXISTS event_data_pkey CASCADE;`,
        prisma.$executeRaw`ALTER TABLE IF EXISTS website DROP CONSTRAINT IF EXISTS website_share_id_key CASCADE;`,
      ]);
    } else {
        await executeRawIgnore('ALTER TABLE session DROP FOREIGN KEY session_website_id_fkey;');
        await executeRawIgnore('ALTER TABLE website DROP FOREIGN KEY website_user_id_fkey;');
        await executeRawIgnore('ALTER TABLE event_data DROP FOREIGN KEY event_data_event_id_fkey;');
    }

    success('Dropped v1 database keys.');
  } catch (e) {
    console.log(e);
    error('Failed to drop v1 database keys.');
    process.exit(1);
  }
}

async function dropV1Indexes(databaseType) {
  try {
    // drop indexes
    if (databaseType === 'postgresql') {
      await prisma.$transaction([
        prisma.$executeRaw`DROP INDEX IF EXISTS session_session_id_key;`,
        prisma.$executeRaw`DROP INDEX IF EXISTS session_created_at_idx;`,
        prisma.$executeRaw`DROP INDEX IF EXISTS session_website_id_idx;`,
        prisma.$executeRaw`DROP INDEX IF EXISTS website_website_id_key;`,
        prisma.$executeRaw`DROP INDEX IF EXISTS website_share_id_key;`,
        prisma.$executeRaw`DROP INDEX IF EXISTS website_user_id_idx;`,
        prisma.$executeRaw`DROP INDEX IF EXISTS website_created_at_idx;`,
        prisma.$executeRaw`DROP INDEX IF EXISTS website_share_id_idx;`,
        prisma.$executeRaw`DROP INDEX IF EXISTS event_data_created_at_idx;`,
        prisma.$executeRaw`DROP INDEX IF EXISTS event_data_website_id_idx;`,
        prisma.$executeRaw`DROP INDEX IF EXISTS event_data_website_event_id_idx;`,
        
      ]);
    } else {
        await executeRawIgnore('DROP INDEX session_created_at_idx ON session;');
        await executeRawIgnore('DROP INDEX session_website_id_idx ON session;');
        await executeRawIgnore('DROP INDEX session_session_id_key ON session;');
        await executeRawIgnore('DROP INDEX website_website_id_key ON website;');
        await executeRawIgnore('DROP INDEX website_share_id_key ON website;');
        await executeRawIgnore('DROP INDEX website_user_id_idx ON website;');
        await executeRawIgnore('DROP INDEX website_created_at_idx ON website;');
        await executeRawIgnore('DROP INDEX website_share_id_idx ON website;');
        await executeRawIgnore('DROP INDEX event_data_created_at_idx ON event_data;');
        await executeRawIgnore('DROP INDEX event_data_website_id_idx ON event_data;');
        await executeRawIgnore('DROP INDEX event_data_website_event_id_idx ON event_data;');
        await executeRawIgnore('DROP INDEX event_data_website_id_website_event_id_created_at_idx ON event_data;');
    }

    success('Dropped v1 database indexes.');
  } catch (e) {
    console.log(e);
    error('Failed to drop v1 database indexes.');
    process.exit(1);
  }
}

async function renameV1Tables(databaseType) {
  try {
    // rename tables
    if (databaseType === 'postgresql') {
      await prisma.$transaction([
        prisma.$executeRaw`ALTER TABLE IF EXISTS _prisma_migrations RENAME TO v1_prisma_migrations;`,
        prisma.$executeRaw`ALTER TABLE IF EXISTS account RENAME TO v1_account;`,
        prisma.$executeRaw`ALTER TABLE IF EXISTS event RENAME TO v1_event;`,
        prisma.$executeRaw`ALTER TABLE IF EXISTS event_data RENAME TO v1_event_data;`,
        prisma.$executeRaw`ALTER TABLE IF EXISTS pageview RENAME TO v1_pageview;`,
        prisma.$executeRaw`ALTER TABLE IF EXISTS session RENAME TO v1_session;`,
        prisma.$executeRaw`ALTER TABLE IF EXISTS website RENAME TO v1_website;`,
      ]);
    } else {
        await executeRawIgnore('RENAME TABLE _prisma_migrations TO v1_prisma_migrations;');
        await executeRawIgnore('RENAME TABLE account TO v1_account;');
        await executeRawIgnore('RENAME TABLE event TO v1_event;');
        await executeRawIgnore('RENAME TABLE event_data TO v1_event_data;');
        await executeRawIgnore('RENAME TABLE pageview TO v1_pageview;');
        await executeRawIgnore('RENAME TABLE session TO v1_session;');
        await executeRawIgnore('RENAME TABLE website TO v1_website;');
    }

    success('Renamed v1 database tables.');
  } catch (e) {
    console.log(e);
    error('Failed to rename v1 database tables.');
    process.exit(1);
  }
}

async function deleteV1TablesPrompt() {
  const response = await prompts({
    type: 'text',
    name: 'value',
    message: 'Do you want to delete V1 database tables? (Y/N)',
    validate: value =>
      value.toUpperCase() !== 'Y' && value.toUpperCase() !== 'N' ? `Please enter Y or N.` : true,
  });

  if (response.value.toUpperCase() == 'Y') {
    await deleteV1Tables();
  }

  success('Migration successfully completed.');
}

async function deleteEventDataTable() {
  try {
    const record = await prisma.$queryRaw`select * from v1_event_data limit 1`;

    if (record.length === 0) {
      await prisma.$executeRaw`DROP TABLE IF EXISTS v1_event_data;`;
    }
  } catch (e) {
     //Ignore
  }
}

async function deleteV1Tables() {
  try {
    // drop tables
    await prisma.$transaction([
      prisma.$executeRaw`DROP TABLE IF EXISTS v1_prisma_migrations;`,
      prisma.$executeRaw`DROP TABLE IF EXISTS v1_event;`,
      prisma.$executeRaw`DROP TABLE IF EXISTS v1_pageview;`,
      prisma.$executeRaw`DROP TABLE IF EXISTS v1_session;`,
      prisma.$executeRaw`DROP TABLE IF EXISTS v1_website;`,
      prisma.$executeRaw`DROP TABLE IF EXISTS v1_account;`,
    ]);

    await deleteEventDataTable();

    success('Dropped v1 database tables.');
  } catch (e) {
    console.log(e);
    throw new Error('Failed to drop v1 database tables.');
  }
}

async function runSqlFile(filePath) {
  try {
    const rawSql = await fse.promises.readFile(path.join(__dirname, filePath));

    const sqlStatements = rawSql
      .toString()
      .split('\n')
      .filter(line => !line.startsWith('--')) // remove comments-only lines
      .join('\n')
      .replace(/\r\n|\n|\r/g, ' ') // remove newlines
      .replace(/\s+/g, ' ') // excess white space
      .split(';');

    for (const sql of sqlStatements) {
      if (sql.length > 0) {
        await prisma.$executeRawUnsafe(sql);
      }
    }
    filePath;

    success(`Ran sql file ${filePath}.`);
  } catch (e) {
    console.log(e);
    throw new Error(`Failed to run sql file ${filePath}.`);
  }
}

function delay(time) {
  return new Promise(resolve => setTimeout(resolve, time));
}

// migration workflow
(async () => {
  databaseType = getDatabaseType();
  prisma = new PrismaClient();

  let err = false;
  for (let fn of [
    checkEnv,
    checkConnection,
    checkV1Tables,
    checkV1TablesReady,
    checkV2Tables,
    checkMigrationReady,
    migrateData,
    deleteV1TablesPrompt,
  ]) {
    try {
      await fn();
    } catch (e) {
      error(e.message);
      err = true;
    } finally {
      await prisma.$disconnect();
      if (err) {
        process.exit(1);
      }
    }
  }
})();