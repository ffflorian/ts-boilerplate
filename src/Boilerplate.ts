import {https} from 'follow-redirects';
import * as fs from 'fs-extra';
import * as JSZip from 'jszip';
import * as os from 'os';
import * as path from 'path';

interface BoilerplateOptions {
  description?: string;
  name?: string;
  /** Where to save the boilerplate. Defaults to "." */
  outputDir?: string;
  yes?: boolean;
}

const defaultOptions: Required<BoilerplateOptions> = {
  description: '<description>',
  name: '<name>',
  outputDir: '.',
  yes: false,
};

const boilerplateEntries = [
  '.editorconfig',
  '.github/main.workflow',
  '.gitignore',
  '.npmrc',
  '.prettierignore',
  '.releaserc.json',
  'package.json',
  'README.md',
  'tsconfig.jasmine.json',
  'tsconfig.json',
  'tslint.json',
];

const devDependencies = [
  '@ffflorian/prettier-config',
  '@ffflorian/tslint-config',
  '@semantic-release/changelog',
  '@semantic-release/git',
  '@types/jasmine',
  '@types/node',
  'husky',
  'jasmine',
  'lint-staged',
  'prettier',
  'rimraf',
  'semantic-release',
  'ts-node',
  'tslint',
  'tslint-config-prettier',
  'tslint-plugin-prettier',
  'typescript',
];

export class TSBoilerplate {
  private readonly boilerplateEntries: string[];
  private readonly downloadUrl: string;
  private readonly options: Required<BoilerplateOptions>;
  private readonly downloadProjectName: string;
  private downloadTmpDir?: string;
  private unzipTmpDir?: string;

  constructor(options?: BoilerplateOptions) {
    this.options = {...defaultOptions, ...options};
    this.options.outputDir = path.resolve(this.options.outputDir);
    this.downloadProjectName = 'ts-boilerplate';
    this.downloadUrl = `https://github.com/ffflorian/${this.downloadProjectName}/archive/master.zip`;
    this.boilerplateEntries = boilerplateEntries;
    fs.ensureDirSync(this.options.outputDir);
  }

  private async createTmpDir(): Promise<string> {
    const osTmpDir = os.tmpdir();
    const fullPath = path.join(osTmpDir, `${this.downloadProjectName}-`);
    const tmpDir = await fs.mkdtemp(fullPath);
    console.info(`Created temp dir "${tmpDir}"`);
    return tmpDir;
  }

  public async download(): Promise<void> {
    if (!this.downloadTmpDir) {
      console.info(`No temp dir yet. Creating ...`);
      this.downloadTmpDir = await this.createTmpDir();
    }

    const downloadFile = path.join(this.downloadTmpDir, 'boilerplate.zip');

    await new Promise((resolve, reject) => {
      console.info(`Downloading project from "${this.downloadUrl}" ...`);
      https.get(this.downloadUrl, response => {
        if (!response.statusCode || response.statusCode < 200 || response.statusCode > 299) {
          return reject(`Failed to download, status code: ${response.statusCode}`);
        }

        const writeStream = fs
          .createWriteStream(downloadFile)
          .on('finish', resolve)
          .on('error', reject);

        response.on('error', reject).pipe(writeStream);
      });
    });
  }

  public async write(): Promise<void> {
    if (!this.downloadTmpDir || !this.unzipTmpDir) {
      throw new Error('No files downloaded yet');
    }

    console.info('Copying needed files ...');

    for (const entry of this.boilerplateEntries) {
      const resolvedSourceFile = path.join(this.unzipTmpDir, entry);
      const resolvedDestFile = path.join(this.options.outputDir, entry);
      try {
        await fs.copy(resolvedSourceFile, resolvedDestFile, {
          errorOnExist: true,
          overwrite: this.options.yes,
        });
      } catch (error) {
        console.error(error);
      }
    }
  }

  private generateMarkdownImageLink(imageUrl: string, linkUrl?: string, imageTitle: string = ''): string {
    return `[![${imageTitle}](${imageUrl})](${linkUrl})`;
  }

  private async createReadme(): Promise<void> {
    const {description, name} = this.options;
    if (!this.downloadTmpDir || !this.unzipTmpDir) {
      throw new Error('No files downloaded yet');
    }

    const readmeFile = path.join(this.unzipTmpDir, 'README.md');
    const buildStatus = this.generateMarkdownImageLink(
      `https://action-badges.now.sh/ffflorian/${name}`,
      `https://github.com/ffflorian/${name}/actions/`,
      'Build Status'
    );
    const dependabotStatus = this.generateMarkdownImageLink(
      `https://api.dependabot.com/badges/status?host=github&repo=ffflorian/${name}`,
      'https://dependabot.com',
      'Dependabot Status'
    );
    const readmeContent = `# ${name} ${buildStatus} ${dependabotStatus}\n\n${description}\n`;
    await fs.writeFile(readmeFile, readmeContent, 'utf8');
  }

  private async cleanupPackage(): Promise<void> {
    if (!this.downloadTmpDir || !this.unzipTmpDir) {
      throw new Error('No files downloaded yet');
    }

    const packageJsonFile = path.join(this.unzipTmpDir, 'package.json');
    const packageJson = await fs.readJSON(packageJsonFile);
    packageJson.dependencies = {};
    packageJson.description = this.options.description;
    packageJson.name = this.options.name;
    packageJson.repository = '<repository>';
    packageJson.version = '1.0.0';
    delete packageJson.bin;
    const newDevDeps = devDependencies.reduce((dependencies: Record<string, string>, dependency: string) => {
      dependencies[dependency] = packageJson.devDependencies[dependency];
      return dependencies;
    }, {});
    packageJson.devDependencies = newDevDeps;
    await fs.writeFile(packageJsonFile, JSON.stringify(packageJson, null, 2), 'utf8');
  }

  public async unzip(): Promise<void> {
    if (!this.downloadTmpDir) {
      throw new Error('No files downloaded yet');
    }

    this.unzipTmpDir = await this.createTmpDir();

    const jszip = new JSZip();
    const zipFile = path.join(this.downloadTmpDir, 'boilerplate.zip');
    const data = await fs.readFile(zipFile);
    const entries: Array<[string, JSZip.JSZipObject]> = [];

    await jszip.loadAsync(data, {createFolders: true});

    const topDirectoryName = `${this.downloadProjectName}-master`;

    jszip.forEach((filePath, entry) => {
      filePath = filePath.replace(`${topDirectoryName}/`, '');
      entry.name = entry.name.replace(`${topDirectoryName}/`, '');
      entries.push([filePath, entry]);
    });

    for (const [filePath, entry] of entries) {
      const resolvedFilePath = path.join(this.unzipTmpDir, filePath);
      if (entry.dir) {
        await fs.ensureDir(resolvedFilePath);
      } else {
        const data = await entry.async('nodebuffer');
        await fs.writeFile(resolvedFilePath, data, 'utf-8');
      }
    }

    await this.cleanupPackage();
    await this.createReadme();
  }

  public async cleanup(): Promise<void> {
    if (this.downloadTmpDir) {
      console.info('Cleaning temporary download directory ...');
      await fs.remove(this.downloadTmpDir);
    }

    if (this.unzipTmpDir) {
      console.info('Cleaning temporary unzip directory ...');
      await fs.remove(this.unzipTmpDir);
    }
  }
}
