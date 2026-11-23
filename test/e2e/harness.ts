// Uçtan uca deneme için: eklentinin gerçek `activate()` kodunu sahte `vscode` modülüyle çalıştırır.
// test/e2e/run.mjs bunu esbuild ile paketler (`vscode` → test/vscode-stub.ts).
export { stub, fakeContext, closeWatchers, commands, extensions } from '../vscode-stub';
export { activate, deactivate } from '../../src/extension';
