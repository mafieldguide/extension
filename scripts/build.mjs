// Packs src/ into one zip per browser, in dist/.
// Chrome and Edge take manifest.json; Firefox takes manifest.firefox.json, renamed to manifest.json in its zip.
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const source = resolve(root, 'src');
const outDir = resolve(root, 'dist');

const version = (file) => JSON.parse(readFileSync(resolve(source, file), 'utf8')).version;
const [chromeVersion, firefoxVersion] = [version('manifest.json'), version('manifest.firefox.json')];
if (chromeVersion !== firefoxVersion) {
	console.error(
		`Manifest versions differ: manifest.json ${chromeVersion}, manifest.firefox.json ${firefoxVersion}`,
	);
	process.exit(1);
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

for (const browser of ['chrome', 'firefox']) {
	const stage = mkdtempSync(join(tmpdir(), `makg-${browser}-`));
	cpSync(source, stage, { recursive: true });
	if (browser === 'firefox') {
		rmSync(join(stage, 'manifest.json'));
		renameSync(join(stage, 'manifest.firefox.json'), join(stage, 'manifest.json'));
	} else {
		rmSync(join(stage, 'manifest.firefox.json'));
	}
	const out = join(outDir, `ma-field-guide-exporter-${browser}.zip`);
	execFileSync('zip', ['-rq', '-X', out, '.', '-x', '.*'], { cwd: stage });
	rmSync(stage, { recursive: true, force: true });
	console.log(
		`${browser} ${chromeVersion} -> ${out.replace(root + '/', '')} (${Math.round(statSync(out).size / 1024)} KB)`,
	);
}
