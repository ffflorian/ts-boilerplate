#!/usr/bin/env node

import {getYesNo} from 'cli-interact';
import * as program from 'commander';
import * as fs from 'fs-extra';
import * as path from 'path';

import {TSBoilerplate} from './Boilerplate';

const defaultPackageJsonPath = path.join(__dirname, 'package.json');
const packageJsonPath = fs.existsSync(defaultPackageJsonPath)
  ? defaultPackageJsonPath
  : path.join(__dirname, '../package.json');

const {description, name, version}: {description: string; name: string; version: string} = fs.readJSONSync(
  packageJsonPath
);

program
  .name(name.replace(/^@[^/]+\//, ''))
  .description(description)
  .option('-o, --output <dir>', 'set the output directory', '.')
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

if (!fs.existsSync(path.resolve('.git')) && !program.yes) {
  const canContinue = getYesNo('No git directory found. Do you really want to continue?');
  if (!canContinue) {
    process.exit();
  }
}

boilerplate
  .download()
  .then(() => boilerplate.unzip())
  .then(() => boilerplate.write())
  .then(() => boilerplate.cleanup())
  .then(() => console.log('Done'))
  .catch(async error => {
    console.error(error);
    await boilerplate.cleanup();
    process.exit(1);
  });
