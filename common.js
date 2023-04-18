const chalk = require("chalk");

 exports.error = function error(msg) {
  console.log(chalk.redBright(`✗ ${msg}`));
}

exports.inProgress = function inProgress(msg) {
  console.log(chalk.yellowBright(`✓ ${msg}`));
}

exports.success = function success(msg) {
  console.log(chalk.greenBright(`✓ ${msg}`));
}