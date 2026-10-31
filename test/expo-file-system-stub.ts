// Test-only stand-in: the real expo-file-system requires the native runtime.
// No unit test exercises file writing; any call here fails loudly.
export class Directory {
  static pickDirectoryAsync(): Promise<Directory> {
    return Promise.reject(new Error('expo-file-system is unavailable in tests'))
  }
}
