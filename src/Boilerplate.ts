import * as fs from 'fs-extra';
import * as https from 'http';
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

export class TSBoilerplate {
  private readonly boilerplateEntries: string[];
  private readonly downloadUrl: string;
  private readonly options: Required<BoilerplateOptions>;
  private downloadTmpDir?: string;
  private unzipTmpDir?: string;

  constructor(options?: BoilerplateOptions) {
    this.options = {...defaultOptions, ...options};
    this.options.outputDir = path.resolve(this.options.outputDir);
    //this.downloadUrl = 'https://github.com/ffflorian/ts-boilerplate/archive/master.zip';
    this.downloadUrl = 'http://localhost:8000/master.zip';
    this.boilerplateEntries = boilerplateEntries;
    fs.ensureDirSync(this.options.outputDir);
  }

  private async createTmpDir(): Promise<string> {
    const osTmpDir = os.tmpdir();
    const fullPath = path.join(osTmpDir, 'ts-boilerplate-');
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
      await fs.copy(resolvedSourceFile, resolvedDestFile, {
        overwrite: this.options.yes,
      });
    }
  }

  private async createReadme(): Promise<void> {
    if (!this.downloadTmpDir || !this.unzipTmpDir) {
      throw new Error('No files downloaded yet');
    }

    const readmeFile = path.join(this.unzipTmpDir, 'README.md');
    let readmeContent = `# ${
      this.options.name
    } [![Dependabot Status](https://api.dependabot.com/badges/status?host=github&repo=ffflorian/${
      this.options.name
    })](https://dependabot.com)`;
    readmeContent += `\n\n${this.options.description}`;
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
    delete packageJson.devDependencies['@types/jszip'];
    delete packageJson.devDependencies['@types/fs-extra'];
    await fs.writeFile(packageJsonFile, JSON.stringify(packageJson, null, 2), 'utf8');
  }

  async unzip(): Promise<void> {
    if (!this.downloadTmpDir) {
      throw new Error('No files downloaded yet');
    }

    this.unzipTmpDir = await this.createTmpDir();

    const jszip = new JSZip();
    const zipFile = path.join(this.downloadTmpDir, 'boilerplate.zip');
    const data = await fs.readFile(zipFile);
    const entries: Array<[string, JSZip.JSZipObject]> = [];

    await jszip.loadAsync(data, {createFolders: true});

    jszip.forEach((filePath, entry) => entries.push([filePath, entry]));

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
    await fs.remove(this.downloadTmpDir);
  }
}
