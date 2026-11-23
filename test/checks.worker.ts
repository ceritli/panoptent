// Eşzamanlı yazma testi için ayrı süreç: aynı konunun bir testine art arda sonuç yazar.
//   node checks.worker.js <kök> <konu> <test> <ok|bad> <tekrar>
import { ChecksStore } from '../src/checks';

const [root, topic, testId, state, times] = process.argv.slice(2);
const s = new ChecksStore(root, { who: () => 'worker', lockWait: 20000 });
for (let i = 0; i < Number(times); i++) {
  s.setResult(topic, testId, i % 2 ? state : 'none', state === 'bad' ? 'not ' + i : undefined);
}
s.setResult(topic, testId, state, state === 'bad' ? 'not ' + (Number(times) - 1) : undefined);
