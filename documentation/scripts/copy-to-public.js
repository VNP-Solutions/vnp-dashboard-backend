const fs = require('fs')
const path = require('path')

const buildDir = path.join(__dirname, '..', 'build')
const publicDocsDir = path.join(__dirname, '..', '..', 'public', 'docs')

if (!fs.existsSync(buildDir)) {
  console.error('Docs build folder not found. Run "docusaurus build" first.')
  process.exit(1)
}

fs.rmSync(publicDocsDir, {recursive: true, force: true})
fs.cpSync(buildDir, publicDocsDir, {recursive: true})

console.log(`Copied docs build to ${publicDocsDir}`)
