/// <reference types="node" />
import { createRequire } from 'node:module'

const nodeRequire = createRequire(import.meta.url)

// Test-only stand-in for Metro's numeric image asset handles. Node still
// resolves the real file first, so missing PNG assets fail instead of hiding.
nodeRequire.extensions['.png'] = (module) => {
  module.exports = 1
}
