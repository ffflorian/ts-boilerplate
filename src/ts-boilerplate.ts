import * as fs from 'fs-extra';
import * as https from 'https';
import * as JSZip from 'jszip';
import * as os from 'os';
import * as path from 'path';

interface BoilerplateOptions {
  /** Where to save the boilerplate. Defaults to "." */
  outputDir?: string;
}

const defaultOptions: Required<BoilerplateOptions> = {
  outputDir: '.',
};

const boilerplateEntries = [
  'editorconfig',
  '.github/main.workflow',
  '.gitignore',
  '.huskyrc.json',
  '.npmrc',
  'package.json',
  '.prettierIgnore',
  'prettierrc',
  'README.md',
  '.releaserc.json',
  'tsconfig.json',
  'tsconfig.jasmine.json',
  'tslint.json',
];

class TSBoilerplate {
  private readonly options: Required<BoilerplateOptions>;
  private readonly downloadUrl: string;
  private tmpDir?: string;
  private readonly boilerplateEntries: string[];

  constructor(options?: BoilerplateOptions) {
    this.options = {...defaultOptions, ...options};
    this.options.outputDir = path.resolve(this.options.outputDir);
    this.downloadUrl = 'https://github.com/ffflorian/ts-boilerplate/archive/master.zip';
    this.boilerplateEntries = boilerplateEntries;
  }

  private createTmpDir(): Promise<string> {
    const osTmpDir = os.tmpdir();
    return fs.mkdtemp(path.join(osTmpDir, 'ts-boilerplate-'));
  }

  public async download(): Promise<string> {
    if (!this.tmpDir) {
      this.tmpDir = await this.createTmpDir();
    }
    const downloadFile = path.join(this.tmpDir, 'boilerplate.zip');

    return new Promise((resolve, reject) => {
      https.get(this.downloadUrl, response => {
        if (!response.statusCode || response.statusCode < 200 || response.statusCode > 299) {
          return reject(`Failed to download, status code: ${response.statusCode}`);
        }

        const writeStream = fs
          .createWriteStream(downloadFile)
          .on('finish', () => resolve(downloadFile))
          .on('error', reject);

        response.on('error', reject).pipe(writeStream);
      });
    });
  }

  public async write(): Promise<void> {
    if (!this.tmpDir) {
      throw new Error('No files downloaded yet');
    }
    for (const entry in this.boilerplateEntries) {
      const resolvedFile = path.join(this.tmpDir, entry);
      await fs.copy(resolvedFile, this.options.outputDir);
    }
  }

  public async zip(): Promise<void> {}

  private async cleanupPackage(content: string): Promise<string> {
    const packageJson = JSON.parse(content);
    packageJson.bin = {};
    packageJson.dependencies = {};
    packageJson.description = '<description>';
    packageJson.name = '<name>';
    packageJson.repository = '<repository>';
    packageJson.version = '1.0.0';
    delete packageJson.devDependencies['@types/jszip'];
    delete packageJson.devDependencies['@types/fs-extra'];
    return JSON.stringify(packageJson, null, 2);
  }

  private async unzip(): Promise<void> {
    if (!this.tmpDir) {
      this.tmpDir = await this.createTmpDir();
    }

    const jszip = new JSZip();
    const data = await fs.readFile(path.join(this.tmpDir, 'boilerplate.zip'));
    const entries: Array<[string, JSZip.JSZipObject]> = [];

    await jszip.loadAsync(data, {createFolders: true});

    jszip.forEach((filePath, entry) => entries.push([filePath, entry]));

    for (const [filePath, entry] of entries) {
      const resolvedFilePath = path.join(this.options.outputDir, filePath);
      if (entry.dir) {
        await fs.ensureDir(resolvedFilePath);
      } else {
        const data = await entry.async('nodebuffer');
        await fs.writeFile(resolvedFilePath, data, 'utf-8');
      }
    }
  }
}

export {TSBoilerplate};
