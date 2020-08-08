#!/usr/bin/env node

const path = require("path");
const execa = require("execa");
const chalk = require("chalk");

function getLogger(appName) {
  return (msg) => {
    console.log("\n");
    console.log(
      chalk.blue(
        "==========================================================================="
      )
    );
    console.log(chalk.blue`{bold deploy.js (${appName})} ${msg}`);
    console.log(
      chalk.blue(
        "==========================================================================="
      )
    );
  };
}

function getRemoteExeca(user, host, sshId) {
  return (args) => {
    const fullArgs = [
      "-i",
      sshId,
      "-o",
      "LogLevel=ERROR",
      "-o",
      "StrictHostKeyChecking=no",
      "-o",
      "UserKnownHostsFile=/dev/null",
      `${user}@${host}`,
      ...args,
    ];
    console.log(chalk.blue`{bold Executing...} $ ssh ${fullArgs.join(" ")}`);

    return execa("ssh", fullArgs, {
      stdio: "inherit",
    });
  };
}

async function deploy({
  appName,
  appDir,
  downCmd,
  upCmd,
  user,
  host,
  prodRoot,
  sshId,
}) {
  const log = getLogger(appName);
  const remoteExeca = getRemoteExeca(user, host, sshId);

  const deployDir = `${appName}_${Date.now()}`;
  const deployPath = path.join(prodRoot, deployDir);

  log(`Uploading to ${deployPath}...`);
  // Sync app files to host
  await execa(
    "rsync",
    [
      "-azP",
      "-e",
      `ssh -i ${sshId} -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR`,
      "--progress",
      "--delete",
      "--filter",
      ":- .gitignore",
      appDir.endsWith("/") ? appDir : `${appDir}/`,
      `${user}@${host}:${deployPath}`,
    ],
    {
      stdio: "inherit",
      cwd: appDir,
    }
  );

  log(`Removing previous version of ${appName}...`);
  await remoteExeca([await downCmd({ deployPath })]);

  log(`Starting new version of ${appName}...`);
  await remoteExeca([await upCmd({ deployPath })]);

  log(`Pruning old deploy directories of ${appName}...`);
  await remoteExeca([
    `find ${PROD_ROOT} -maxdepth 1 -type d -name "${appName}*" | grep -v "${deployDir}" | xargs -I{} sudo rm -rf "{}"`,
  ]);

  log(`Successfully deployed ${appName} to ${deployPath}!`);
}

function wrappedDeploy(...args) {
  return deploy(...args).catch((e) => {
    console.error(chalk.red`\n\n=======================================`);
    console.error(chalk.red`{bold Yikes!} Error Running deploy script:`);
    console.error(e);
    console.error(chalk.red`=======================================`);
  });
}

module.exports = wrappedDeploy;
