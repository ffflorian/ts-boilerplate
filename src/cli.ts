#!/usr/bin/env node

import * as program from 'commander';
import {TSBoilerplate} from './Boilerplate';

const {name, version, description}: {name: string; version: string; description: string} = require('../package.json');

program
  .name(name.replace(/^@[^/]+\//, ''))
  .description(description)
  .option('-o, --output <dir>', 'set the output directory (default: ".")')
  .option('-n, --project-name <name>', 'set the project name')
  .option('-d, --project-description <description>', 'set the project name')
  .option('-y, --yes', 'Use default options')
  .version(version, '-v, --version')
  .parse(process.argv);

const boilerplate = new TSBoilerplate({
  ...(program.projectDescription && {description: program.projectDescription}),
  ...(program.projectName && {name: program.projectName}),
  ...(program.output && {outputDir: program.output}),
  ...(typeof program.yes !== 'undefined' && {yes: program.yes}),
});

boilerplate
  .download()
  .then(() => boilerplate.unzip())
  .then(() => boilerplate.write())
  .then(() => boilerplate.cleanup())
  .catch(error => {
    console.error(error);
    return boilerplate.cleanup();
  });
