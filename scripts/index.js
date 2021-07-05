#!/usr/bin/env node

const path = require('path');
const rollup = require('rollup');
const loadConfigFile = require('rollup/dist/loadConfigFile');
const statik = require('node-static');
const { stringify } = require('query-string');
const open = require('open');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const deepmerge = require('deepmerge');
const chokidar = require('chokidar');
const chalk = require('chalk');

class Scripts {
  run(methodName, additionalParameters) {
    const runScript = this[methodName];
    if (typeof runScript == 'function') {
      runScript
        .apply(this, [...additionalParameters])
        .catch((error) => console.error(chalk.red.bold(error)));
    }
  }

  async build() {
    process.env.NODE_ENV = 'production';

    const rollupConfigPath = path.resolve(__dirname, '../rollup.config.js');
    const { options } = await loadConfigFile(rollupConfigPath);

    // // "warnings" wraps the default `onwarn` handler passed by the CLI.
    // // This prints all warnings up to this point:
    // console.log(`We currently have ${warnings.count} warnings`);
    //
    // // This prints all deferred warnings
    // warnings.flush();

    for (const optionsObj of options) {
      const bundle = await rollup.rollup(optionsObj);
      await Promise.all(optionsObj.output.map(bundle.write));
    }
  }

  async dev(env, port) {
    if (!port) {
      port = 8081;
    }

    const tempDirectory = './.temp';

    if (!fs.existsSync(tempDirectory)) {
      console.log(`Creating temporary directory at: ${tempDirectory}`);
      fs.mkdirSync(tempDirectory);
    }

    await watchCodeChanges(tempDirectory);
    watchDefinitionChanges(env, tempDirectory);
    console.log('Starting web server');
    startWebServer(tempDirectory, port);

    const definition = prepareDefinition(env);

    const webAppUrl = getEnvUrl(definition.environment || 'production');
    const plugin = Buffer.from(
      JSON.stringify({ port, pluginId: definition.pluginId })
    ).toString('base64');
    const query = stringify({ plugin });
    const url = `${webAppUrl}/${definition.subscriptionId || ''}?${query}`;

    console.log('');
    console.log('Use the following URL to start using your plugin in Reach:');
    console.log(url);
    console.log('');
    console.log("Keep this process running while you're applying changes.");

    open(url);
  }

  async publishWeb(env, port) {
    if (!port) {
      port = 8081;
    }

    await this.build();

    console.log('Starting web server');
    startWebServer('./dist', port);
    writeDefinition(env, './dist');

    const definition = prepareDefinition(env);
    const webAppUrl = getEnvUrl(definition.environment || 'production');
    const plugin = Buffer.from(
      JSON.stringify({ isPublish: true, port, pluginId: definition.pluginId })
    ).toString('base64');
    const query = stringify({ plugin });
    const url = `${webAppUrl}/${definition.subscriptionId || ''}?${query}`;

    console.log('');
    console.log(
      'Use the following URL to review and publish your plugin via the Reach UI:'
    );
    console.log(url);
    console.log('');

    console.log(
      'When you have published your plugin it will be available to all users within your subscription and you can stop this process.'
    );

    open(url);
    return;
  }

  async publish(env, accessToken) {
    await this.build();

    if (!accessToken) {
      console.error(chalk.red.bold('You need to pass in an access token!'));
      // todo: get from system env var
      return;
    }

    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    const pathToBundle = './dist/index.js';
    const apiEndpoint = getEnvApiUrl(env);
    const definition = require(path.join(process.cwd(), 'definition.json'));
    const { pluginId } = definition;

    console.log('Uploading bundle and definition.');

    await uploadBundle(accessToken, apiEndpoint, pluginId, pathToBundle);

    await uploadDefinition(accessToken, apiEndpoint, pluginId, definition);

    console.log('Success!');
    console.log(
      'Your plugin is now published and available to all users within the specified subscription.'
    );
  }
}

function watchDefinitionChanges(env, tempDirectory) {
  chokidar
    .watch([
      path.join(process.cwd(), 'definition.*.json'),
      path.join(process.cwd(), 'definition.json'),
    ])
    .on('all', () => {
      writeDefinition(env, tempDirectory);
      console.log('Definition updated');
    });
}

function writeDefinition(env, targetDirectory) {
  const definition = prepareDefinition(env);

  fs.writeFileSync(
    path.join(targetDirectory, 'definition.json'),
    JSON.stringify(definition, null, 2)
  );
}

async function watchCodeChanges(tempDirectory) {
  process.env.NODE_ENV = 'development';

  const rollupConfigPath = path.resolve(__dirname, '../rollup.config.js');
  const { options } = await loadConfigFile(rollupConfigPath, {
    dir: tempDirectory,
  });

  const watcher = rollup.watch(options);
  watcher.on('event', ({ code, result, error }) => {
    switch (code) {
      case 'END':
        console.log('Processed your changes and updated the bundle...');
        break;
      case 'ERROR':
        console.error(chalk.red.bold('============'));
        console.error(
          'An error occurred when trying to bundle: ' +
            JSON.stringify(error, null, 2)
        );
        console.error(chalk.red.bold('============'));
        break;
    }

    if (result) {
      result.close();
    }
  });

  console.log('Will now watch for changes in your code....');
}

function prepareDefinition(env) {
  const baseDefinitionPath = path.join(process.cwd(), 'definition.json');
  const envDefinitionPath = path.join(process.cwd(), `definition.${env}.json`);

  const baseDefinition = readJsonFile(baseDefinitionPath);
  if (!fs.existsSync(envDefinitionPath)) {
    return baseDefinition;
  }

  return deepmerge(baseDefinition, readJsonFile(envDefinitionPath), {
    // The naming target and source is confusing
    // source are the values coming from the envSpecificArgument
    arrayMerge: (_target, source) => source,
  });
}

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function startWebServer(dir, port) {
  const file = new statik.Server(dir, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Cache-Control': 'no-cache',
    },
  });

  require('http')
    .createServer((request, response) => {
      request.addListener('end', () => file.serve(request, response)).resume();
    })
    // TODO: maybe auto detect available port
    .listen(port);
}

async function uploadBundle(accessToken, apiEndpoint, pluginId, pathToBundle) {
  let formData = new FormData();
  const fileBundle = fs.createReadStream(pathToBundle);
  formData.append('file', fileBundle);

  const configBundle = {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...formData.getHeaders(),
    },
  };

  try {
    await axios.put(
      `${apiEndpoint}/api/v1/subscriptions/current/plugins/${encodeURI(
        pluginId
      )}/bundle`,
      formData,
      configBundle
    );
    console.log('Bundle uploaded sucessfully.');
  } catch (error) {
    console.log(chalk.red.bold('Error uploading bundle:'));
    console.error(
      error.response.status,
      error.response.statusText,
      error.response.data
    );
    process.exit(1);
  }
}

async function uploadDefinition(
  accessToken,
  apiEndpoint,
  pluginId,
  definition
) {
  const configExtension = {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  };

  try {
    await axios.put(
      `${apiEndpoint}/api/v1/subscriptions/current/plugins/${encodeURI(
        pluginId
      )}/definition`,
      definition,
      configExtension
    );
    console.log('Definition uploaded successfully.');
  } catch (error) {
    console.log(chalk.red.bold('Error uploading definition:'));
    console.error(
      error.response.status,
      error.response.statusText,
      error.response.data
    );
    process.exit(1);
  }
}

function getEnvUrl(env) {
  env = env?.toLowerCase();

  if (env === 'dev') {
    return 'https://app.dev.reach.livetiles.io';
  }

  if (env === 'test') {
    return 'https://app.test.reach.livetiles.io';
  }

  if (env === 'staging') {
    return 'https://app.staging.reach.livetiles.io';
  }

  if (env === 'production') {
    return 'https://reach.livetiles.io';
  }

  return 'http://localhost:3000';
}

function getEnvApiUrl(env) {
  env = env?.toLowerCase();

  if (env === 'dev') {
    return 'https://api.dev.reach.livetiles.io';
  }

  if (env === 'test') {
    return 'https://api.test.reach.livetiles.io';
  }

  if (env === 'staging') {
    return 'https://api.staging.reach.livetiles.io';
  }

  if (env === 'production') {
    return 'https://api.reach.livetiles.io';
  }

  return 'http://localhost:5000';
}

const args = process.argv.slice(2);
new Scripts().run(args[0], args.slice(1));
