const path = require("path");
const del = require("del");
const fse = require("fs-extra");
const prompts = require( "prompts");
const {execSync} = require( "child_process");
const { success } = require('./common');

async function copyDbFiles(databaseType) {
  try {
    const src = path.resolve(__dirname, `./db/${databaseType}`);
    const dest = path.resolve(__dirname, './prisma');

    del.sync(dest, {force: true});

    fse.copySync(src, dest);

    success(`Copied ${src} to ${dest}`);
  } catch (e) {
    throw new Error('Unable to copy db files: ' + e.message);
  }
}

async function prismaGenerate() {
  try {
    console.log(execSync('npx prisma generate').toString());
  } catch (e) {
    throw new Error('Unable to run prisma generate: ' + e.message);
  }
}

(async () => {
  const response = await prompts({
    type: 'select',
    name: 'value',
    choices: [
      { title: 'PostgreSQL', value: 'postgresql' },
      { title: 'MySQL', value: 'mysql' }
    ],
    message: 'Which database are you using?',
  });

  const databaseType = response.value;

  console.log(`Database type selected: ${databaseType}`);

  // copy prisma files and generate prisma client
  await copyDbFiles(databaseType);
  await prismaGenerate();
})();