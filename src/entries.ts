// Kuyruk girdileri: tipler, toplu istem metni ve görsel kaydetme.

import * as fs from 'fs';
import * as path from 'path';
import type { SourceLoc } from './source';

export interface SelectedItem {
  id: number;
  tag: string;
  elId: string;
  classes: string;
  text: string;
  fullText: string;
  textOnly: boolean;
  selector: string;
  source: SourceLoc | null;
  components: string[];
  styles: Record<string, string>;
  html: string;
  size: string;
  href: string;
}

export interface Entry {
  token: string;
  kind: 'prompt' | 'style' | 'text' | 'delete' | 'image';
  items: SelectedItem[];
  viewportOnly?: string | null;
  text?: string; // prompt
  diffs?: Record<string, { from: string; to: string }>; // style
  classes?: string; // style
  from?: string; // text
  to?: string; // text
  fileName?: string; // image
  dataUrl?: string; // image
  url?: string; // image
  saved?: { rel: string; url: string }; // image, kaydedildikten sonra
  raw?: boolean; // prompt: metni olduğu gibi gönder (kurulum talimatları vb.)
}

const VP_NOTE: Record<string, string> = {
  '390': 'YALNIZCA mobil görünümde (ekran genişliği ≤ 390px) geçerli olsun; responsive kırılım noktası kullan, daha geniş ekranları değiştirme.',
  '1024': 'YALNIZCA tablet ve daha dar ekranlarda (≤ 1024px) geçerli olsun; responsive kırılım noktası kullan, masaüstünü değiştirme.',
};

const KIND_TR: Record<Entry['kind'], string> = {
  prompt: 'İstek',
  style: 'Stil',
  text: 'Metin',
  delete: 'Sil',
  image: 'Görsel',
};

export interface PromptOptions {
  id?: string; // Panoptent işlem kimliği (geri alma için transkriptte aranır)
  pageUrl: string;
  detail: boolean; // CLI için daha fazla bağlam (HTML, stiller)
  resolve: (file: string) => Promise<string | undefined>; // proje köküne göre göreli yol
}

async function describeItem(it: SelectedItem, o: PromptOptions, indent: string): Promise<string[]> {
  const L: string[] = [];
  const cls = it.classes ? ` class="${it.classes.slice(0, 160)}"` : '';
  const head = `<${it.tag}${it.elId ? ` id="${it.elId}"` : ''}${cls}>${it.text ? ` “${it.text.slice(0, 120)}”` : ''}`;
  L.push(indent + head);
  if (it.source) {
    const rel = (await o.resolve(it.source.file)) || it.source.file;
    const mention = /\s/.test(rel) ? `"${rel}"` : rel;
    const loc = it.source.line ? `#${it.source.line}` : '';
    const how = it.source.exact ? 'tam konum' : it.source.via === 'vue' ? 'bileşen dosyası, satır bilinmiyor' : 'en yakın bilinen üst öğe';
    L.push(`${indent}  Kaynak: @${mention}${loc} (${how})`);
  } else {
    L.push(`${indent}  Kaynak: bilinmiyor — metin, sınıf veya bileşen adıyla ara`);
  }
  if (it.components?.length) L.push(`${indent}  Bileşen: ${it.components.join(' < ')}`);
  L.push(`${indent}  Seçici: ${it.selector}`);
  if (o.detail) {
    const st = Object.entries(it.styles || {}).map(([k, v]) => `${k}: ${v}`).join('; ');
    if (st) L.push(`${indent}  Hesaplanmış stiller: ${st}`);
    L.push(`${indent}  HTML: ${it.html.replace(/\s+/g, ' ')}`);
  } else {
    const html = it.html.length > 300 ? it.html.slice(0, 300) + '…' : it.html;
    L.push(`${indent}  HTML: ${html.replace(/\s+/g, ' ')}`);
  }
  return L;
}

function changeLine(e: Entry): string {
  switch (e.kind) {
    case 'prompt':
      return `“${(e.text || '').trim()}”`;
    case 'text':
      return `Metni “${e.from}” yerine “${e.to}” yap.`;
    case 'delete':
      return 'Bu öğeyi sayfadan kaldır (kodda sil; gereksiz kalan kodu da temizle).';
    case 'image':
      if (e.saved) return `Görseli projeye kaydettiğim \`${e.saved.rel}\` ile değiştir (tarayıcıdaki adresi: \`${e.saved.url}\`).`;
      return `Görseli şu adresteki görselle değiştir: ${e.url}`;
    case 'style': {
      const parts = Object.entries(e.diffs || {}).map(([k, v]) => `${k}: ${v.from || '?'} → ${v.to}`);
      if (e.classes) parts.push(`şu sınıfları ekle: ${e.classes}`);
      return `Stili değiştir — ${parts.join('; ')}`;
    }
  }
}

export async function buildBatchPrompt(entries: Entry[], o: PromptOptions): Promise<string> {
  const marker = o.id ? `\n\n(Panoptent işlem kimliği: ${o.id} — bu satır yalnızca kayıt içindir.)` : '';
  if (entries.length === 1 && entries[0].raw) return (entries[0].text || '').trim() + marker;
  const L: string[] = [];
  const single = entries.length === 1 && entries[0].kind === 'prompt';
  if (single) {
    L.push((entries[0].text || '').trim());
    L.push('');
  } else {
    L.push(`Önizlemede hazırladığım ${entries.length} değişikliği uygula. Hepsini tek seferde gerçek kaynak dosyalara işle.`);
    L.push('');
  }
  L.push(`Sayfa: ${o.pageUrl}`);

  for (const [i, e] of entries.entries()) {
    L.push('');
    if (!single) L.push(`${i + 1}. [${KIND_TR[e.kind]}] ${changeLine(e)}`);
    if (e.viewportOnly && VP_NOTE[e.viewportOnly]) L.push(`   (${VP_NOTE[e.viewportOnly]})`);
    if (!e.items.length) {
      L.push(single ? '(Belirli bir öğe seçilmedi; istek bu sayfayla ilgili.)' : '   Öğe: tüm sayfa');
      continue;
    }
    if (single) L.push(e.items.length === 1 ? 'Önizlemede seçtiğim öğe:' : `Önizlemede seçtiğim ${e.items.length} öğe:`);
    else L.push(e.items.length === 1 ? '   Öğe:' : `   Öğeler (${e.items.length}):`);
    for (const it of e.items) L.push(...(await describeItem(it, o, single ? '  ' : '     ')));
  }

  L.push('');
  L.push('Kurallar:');
  if (entries.some((e) => e.kind === 'style')) {
    L.push('- Stil değerleri önizlemedeki canlı denemeden geliyor; bunları projenin stil yaklaşımına (Tailwind sınıfları, CSS modülleri, scoped stil vb.) uygun karşılıklarına çevir, satır içi style kullanma.');
  }
  L.push('- Yalnızca istenenleri değiştir; derleme çıktısına (.next, .nuxt, .output, dist, node_modules) dokunma.');
  L.push('- Öğe birden çok yerde kullanılan ortak bir bileşendeyse bunu belirt.');
  L.push('- Dev sunucusu hot reload ile güncelleniyor; yeniden başlatma.');
  L.push('- Bitince ne değiştirdiğini kısaca Türkçe özetle.');
  return L.join('\n') + marker;
}

/** Yüklenen görseli projenin public klasörüne kaydeder. */
export function saveImage(root: string, sourceAbs: string | undefined, e: Entry): { rel: string; url: string } | undefined {
  if (!e.dataUrl) return undefined;
  const m = e.dataUrl.match(/^data:([^;]+);base64,(.*)$/);
  if (!m) return undefined;
  const buf = Buffer.from(m[2], 'base64');
  const extFromMime = (m[1].split('/')[1] || 'png').replace('jpeg', 'jpg').replace('svg+xml', 'svg');
  const base = (e.fileName || 'gorsel').replace(/\.[^.]+$/, '');
  const ext = (path.extname(e.fileName || '').slice(1) || extFromMime).toLowerCase();
  const safe =
    base
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase() || 'gorsel';

  // Seçilen öğenin dosyasından yukarı çıkarak package.json'u olan klasörü bul (monorepo/alt klasör frontend'ler için)
  let pkgDir = root;
  if (sourceAbs) {
    let d = path.dirname(sourceAbs);
    while (d.startsWith(root) && d.length >= root.length) {
      if (fs.existsSync(path.join(d, 'package.json'))) {
        pkgDir = d;
        break;
      }
      const up = path.dirname(d);
      if (up === d) break;
      d = up;
    }
  }
  const publicDir = path.join(pkgDir, 'public');
  const dir = path.join(publicDir, 'panoptent');
  fs.mkdirSync(dir, { recursive: true });
  let name = `${safe}.${ext}`;
  for (let i = 2; fs.existsSync(path.join(dir, name)); i++) name = `${safe}-${i}.${ext}`;
  fs.writeFileSync(path.join(dir, name), buf);
  return { rel: path.relative(root, path.join(dir, name)).split(path.sep).join('/'), url: `/panoptent/${name}` };
}
