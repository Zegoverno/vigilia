import { readFileSync, readdirSync } from 'node:fs';

const {packages} = JSON.parse(readFileSync('package-lock.json','utf8'));
console.log('License notices for the Vigília production dependency tree.\n');
for (const [path, meta] of Object.entries(packages).sort()) {
  if (!path || meta.dev) continue;
  const files = readdirSync(path).filter(name => /^(licen[cs]e|copying|notice)(\.|$)/i.test(name)).sort();
  if (!files.length) throw Error(`Missing license text for ${path}`);
  console.log(`\n=== ${path.split('node_modules/').at(-1)}@${meta.version} (${meta.license}) ===`);
  for (const file of files) console.log(readFileSync(`${path}/${file}`,'utf8'));
}
