#!/usr/bin/env node

import * as program from 'commander';
import {TSBoilerplate} from './ts-boilerplate';

const {name, version, description}: {name: string; version: string; description: string} = require('../package.json');

program
  .name(name.replace(/^@[^/]+\//, ''))
  .description(description)
  .option('-o, --output <dir>', 'set the output directory (default: ".")')
  .option('-y, --yes', 'Use default options')
  .version(version, '-v, --version');

new TSBoilerplate({
  ...(program.output && {outputDir: program.output}),
  ...(typeof program.yes !== 'undefined' && {yes: program.yes}),
});
