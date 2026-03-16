// @ts-check
const { execSync } = require('child_process')
const fs = require('fs')

const entryPoints = [
  { input: 'dist_tsc/deploy/index.js', output: 'dist/deploy.js' },
  { input: 'dist_tsc/preview-branch/index.js', output: 'dist/preview-branch.js' },
  { input: 'dist_tsc/rollback/index.js', output: 'dist/rollback.js' },
]

fs.mkdirSync('dist', { recursive: true })

for (const { input, output } of entryPoints) {
  const tmpDir = `_bundle_${Math.random().toString(36).slice(2)}`
  execSync(`ncc build ${input} -o ${tmpDir} --minify`, { stdio: 'inherit' })
  fs.renameSync(`${tmpDir}/index.js`, output)
  fs.rmSync(tmpDir, { recursive: true })
}
