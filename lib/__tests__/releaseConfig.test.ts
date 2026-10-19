import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

function readJson(path: string) {
  return JSON.parse(readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8'))
}

const { expo } = readJson('app.json')
const manifest = readJson('package.json')
const lock = readJson('package-lock.json')
const eas = readJson('eas.json')
const excluded = new Set(
  readFileSync(new URL('../../.easignore', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#')),
)

describe('native widget release configuration', () => {
  it('isolates the camera runtime and does not add microphone access', () => {
    expect(expo.version).not.toBe('1.2.0')
    expect(expo.android.versionCode).toBeGreaterThan(3)
    const camera = expo.plugins.find((plugin: unknown) => Array.isArray(plugin) && plugin[0] === 'expo-camera')
    expect(camera?.[1]).toMatchObject({ recordAudioAndroid: false, microphonePermission: false, barcodeScannerEnabled: true })
  })
  it('isolates the three-provider runtime from earlier native APKs', () => {
    expect(expo.runtimeVersion).toEqual({ policy: 'appVersion' })
    expect(['1.0.0', '1.1.0']).not.toContain(expo.version)
    expect(expo.android.versionCode).toBeGreaterThan(2)
  })

  it('keeps application and npm release versions consistent', () => {
    expect(manifest.version).toBe(expo.version)
    expect(lock.version).toBe(expo.version)
    expect(lock.packages[''].version).toBe(expo.version)
  })

  it('builds a standalone APK on the existing OTA channel', () => {
    expect(eas.build.preview.developmentClient).not.toBe(true)
    expect(eas.build.preview.android.buildType).toBe('apk')
    expect(eas.build.preview.channel).toBe('preview')
    expect(expo.updates.enabled).toBe(true)
  })

  it('regenerates native projects instead of uploading local debug outputs', () => {
    expect(excluded.has('/android')).toBe(true)
    expect(excluded.has('/ios')).toBe(true)
    expect(excluded.has('/android/')).toBe(true)
    expect(excluded.has('/ios/')).toBe(true)
  })

  it('excludes local environment and signing credentials from the archive', () => {
    for (const pattern of ['.env*', '*.jks', '*.p12', '*.p8', '*.key', '*.pem', 'credentials.json']) {
      expect(excluded.has(pattern), `missing exclusion: ${pattern}`).toBe(true)
    }
  })
})
