# dumb-deploy

**Simple application deployment for side projects**

This is a stupid script I use to deploy applications to a remote web server for my side projects with minimal hassle/setup - on a budget!

## Install

```
$ yarn add dumb-deploy
```

### Usage

Here's an example for deploying a containerized docker app:

<details><summary><b>Docker App</b></summary>
<p>

```js
const deploy = require("dumb-deploy");

/**
 * downCmd should kill any previous instances of the app.
 * Be agressive. We don't provide any context to the previous deployment.
 * Be careful not to kill other applications running on the server.
 * (Don't worry about cleaning up the directory, we'll do that for you.)
 */
async function downCmd() {
  return `docker ps -a --filter="name=nginx" --format "{{.ID}}" | xargs -I{} docker rm --force "{}"`;
}

/**
 * Start the application. Process should not run in the foreground.
 */
async function upCmd({ deployPath }) {
  // https://docs.docker.com/compose/production/#deploying-changes
  return `cd ${deployPath} && docker-compose up --no-deps -d nginx`;
}

async function main() {
  await deploy({
    // Specify a directory-friendly name for this app
    appName: "nginx",
    // Path to the root of your app
    appDir: path.join(__dirname, ".."),
    downCmd,
    upCmd,
    // user/host of the webserver
    user: "mark",
    host: "1.2.3.4",
    // Where should we deploy applications to on the host?
    prodRoot: "/home/mark/prod",
    // Path to an SSH key that we can SSH into the server with
    sshId: "/Users/mark/.ssh/deploy",
  });
}

main();
```

</p>
</details>

Here's another example for a NodeJS app:

<details><summary><b>NodeJS App</b></summary>
<p>

`deploy/deploy.js`:

```js
const deploy = require("dumb-deploy");
const path = require("path");

async function downCmd({ deployPath }) {
  return path.join(deployPath, "deploy", "down.sh");
}

async function upCmd({ deployPath }) {
  return path.join(deployPath, "deploy", "up.sh");
}

async function main() {
  await deploy({
    // Specify a directory-friendly name for this app
    appName: "api_server",
    // Path to the root of your app
    appDir: path.join(__dirname, ".."),
    downCmd,
    upCmd,
    // user/host of the webserver
    user: "mark",
    host: "1.2.3.4",
    // Where should we deploy applications to on the host?
    prodRoot: "/home/mark/prod",
    // Path to an SSH key that we can SSH into the server with
    sshId: "/Users/mark/.ssh/deploy",
  });
}

main();
```

`deploy/down.sh`:

```bash
#!/bin/bash
set -euo pipefail

# https://stackoverflow.com/a/246128/4396258
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
ROOT="${DIR}/.."

# Brutally clean up all old instances of the app running under forever. Life's too short for gracefulness.
# (Make sure to grep filter for our app specifcially tho, to avoid killing other apps running on this server)
ps aux | grep forever | grep build/index.js | awk '{print $2}' | xargs -I{} kill -9 {} || true
lsof -i :44525 | grep node | awk '{print $2}' | xargs -I{} kill -9 {} || true
```

`deploy/up.sh`:

```bash
#!/bin/bash
set -euo pipefail

# https://stackoverflow.com/a/246128/4396258
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
ROOT="${DIR}/.."

# run commands from the deploy dir root
pushd "${ROOT}"

make build
NODE_ENV=production yarn start
```

</p>
</details>

- When you want to push a new version of your app to your webserver, run your `deploy.js` script
- The application files will be rsync'd to a new directory
- .gitignore files will not rsync'd
- I'd suggest calling your deploy script manually instead of putting it in a CI pipeline. Since you're artisanally hand crafting your deploy logic, it's probably going to break sometimes if something gets stuck. You'll want to be able to ssh in and unjam things occasionally.

## Motivation: What is this for?

- **Side projects** that need a server runtime exposed to the world wide web
- (For simple static websites, one should probably just use vercel or netlify etc)

### Why not use \<insert SaaS cloud provider here>?

- I'm cheap, and I want to deploy my side projects to the web for the least amount of money
- But I also don't want to compromise on availability (e.g. sleeping Heroku dynos)
- I don't want to deal with complex networking setups to let the DB talk to the API server etc (sorry AWS)
- I want an actual relational database that lives close to the API server (sorry Fauna)
- This lets me deploy a Postgres DB, API Server and Web Server all on the same vultr web server for \$2.50/month
- Once the project graduates beyond "side project" to "serious production", you should probably ditch this and seek out a SaaS/AWS solution to get fancy CI pipelines,

### Why not use Lambda Functions for everything?

- I'll appeal to authority: [The Good Parts of AWS
  ](https://www.goodreads.com/book/show/49966180-the-good-parts-of-aws):

  > A problem we often see is that people
  > sometimes mistake Lambda for a general-purpose
  > application host. Unlike EC2, it is very hard to run a
  > sophisticated piece of software on Lambda without
  > making some very drastic changes to your application and
  > accepting some significant new limitations from the
  > platform.
  >
  > Treating Lambda as a general-purpose host for your
  > applications is risky. It might look compelling at first—no
  > servers to manage, no operating system to worry about,
  > and no costs when unused—but Lambda’s limitations are
  > insidious hidden risks that typically reveal themselves
  > once your application evolves into something bigger.
  > Then, things start coming at you one after the other, and
  > before you know it, you are spending most of your time
  > trying to figure out convoluted solutions to Lambda’s
  > numerous limitations.

  (I'll avoid quoting further, you should definitely [buy the book](https://gumroad.com/l/aws-good-parts) if you're doing anything with AWS.)

## Non goals

- Rollbacks (maybe I'll add this in the future if I can get the API simple enough)
- Fancy [blue/green deployments](https://martinfowler.com/bliki/BlueGreenDeployment.html). You're probably going to have a couple of minutes of downtime during deploys.
