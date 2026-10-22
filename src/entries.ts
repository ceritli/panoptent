// Kuyruk girdileri: tipler, toplu istem metni ve görsel kaydetme.

import * as fs from 'fs';
import * as path from 'path';
import type { SourceLoc } from './source';
import { addStrings, t } from './i18n';

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

addStrings({
  en: {
    'ext.p.vp390': 'Apply ONLY on mobile (screen width ≤ 390px); use a responsive breakpoint and do not change wider screens.',
    'ext.p.vp1024': 'Apply ONLY on tablet and narrower screens (≤ 1024px); use a responsive breakpoint and do not change desktop.',
    'ext.p.kind.prompt': 'Request',
    'ext.p.kind.style': 'Style',
    'ext.p.kind.text': 'Text',
    'ext.p.kind.delete': 'Delete',
    'ext.p.kind.image': 'Image',
    'ext.p.howExact': 'exact location',
    'ext.p.howVue': 'component file, line unknown',
    'ext.p.howParent': 'nearest known ancestor',
    'ext.p.source': 'Source: @{0}{1} ({2})',
    'ext.p.sourceUnknown': 'Source: unknown — search by text, class or component name',
    'ext.p.component': 'Component: {0}',
    'ext.p.selector': 'Selector: {0}',
    'ext.p.styles': 'Computed styles: {0}',
    'ext.p.text': 'Change the text “{0}” to “{1}”.',
    'ext.p.delete': 'Remove this element from the page (delete it in the code; also clean up any code left unused).',
    'ext.p.imageSaved': 'Replace the image with `{0}`, which I saved in the project (browser URL: `{1}`).',
    'ext.p.imageUrl': 'Replace the image with the one at this URL: {0}',
    'ext.p.addClasses': 'add these classes: {0}',
    'ext.p.style': 'Change the style — {0}',
    'ext.p.marker': '(Panoptent apply ID: {0} — this line is for tracking only.)',
    'ext.p.batch': 'Apply the {0} changes I prepared in the preview. Write them all to the real source files in one go.',
    'ext.p.page': 'Page: {0}',
    'ext.p.noItemSingle': '(No specific element selected; the request is about this page.)',
    'ext.p.noItem': '   Element: whole page',
    'ext.p.selOne': 'The element I selected in the preview:',
    'ext.p.selMany': 'The {0} elements I selected in the preview:',
    'ext.p.itemOne': '   Element:',
    'ext.p.itemMany': '   Elements ({0}):',
    'ext.p.rules': 'Rules:',
    'ext.p.ruleStyle': '- The style values come from live tweaking in the preview; translate them to the project’s styling approach (Tailwind classes, CSS modules, scoped styles, etc.); do not use inline styles.',
    'ext.p.ruleDesign': '- Follow the project’s design rules in `{0}` (read it first if you have not read it in this conversation).',
    'ext.p.ruleOnly': '- Change only what was asked; do not touch build output (.next, .nuxt, .output, dist, node_modules).',
    'ext.p.ruleShared': '- If the element is in a shared component used in several places, mention it.',
    'ext.p.ruleHmr': '- The dev server updates via hot reload; do not restart it.',
    'ext.p.ruleSummary': '- When done, briefly summarize what you changed.',
    'ext.p.unknownPage': '(unknown)',
  },
  tr: {
    'ext.p.vp390': 'YALNIZCA mobil görünümde (ekran genişliği ≤ 390px) geçerli olsun; responsive kırılım noktası kullan, daha geniş ekranları değiştirme.',
    'ext.p.vp1024': 'YALNIZCA tablet ve daha dar ekranlarda (≤ 1024px) geçerli olsun; responsive kırılım noktası kullan, masaüstünü değiştirme.',
    'ext.p.kind.prompt': 'İstek',
    'ext.p.kind.style': 'Stil',
    'ext.p.kind.text': 'Metin',
    'ext.p.kind.delete': 'Sil',
    'ext.p.kind.image': 'Görsel',
    'ext.p.howExact': 'tam konum',
    'ext.p.howVue': 'bileşen dosyası, satır bilinmiyor',
    'ext.p.howParent': 'en yakın bilinen üst öğe',
    'ext.p.source': 'Kaynak: @{0}{1} ({2})',
    'ext.p.sourceUnknown': 'Kaynak: bilinmiyor — metin, sınıf veya bileşen adıyla ara',
    'ext.p.component': 'Bileşen: {0}',
    'ext.p.selector': 'Seçici: {0}',
    'ext.p.styles': 'Hesaplanmış stiller: {0}',
    'ext.p.text': 'Metni “{0}” yerine “{1}” yap.',
    'ext.p.delete': 'Bu öğeyi sayfadan kaldır (kodda sil; gereksiz kalan kodu da temizle).',
    'ext.p.imageSaved': 'Görseli projeye kaydettiğim `{0}` ile değiştir (tarayıcıdaki adresi: `{1}`).',
    'ext.p.imageUrl': 'Görseli şu adresteki görselle değiştir: {0}',
    'ext.p.addClasses': 'şu sınıfları ekle: {0}',
    'ext.p.style': 'Stili değiştir — {0}',
    'ext.p.marker': '(Panoptent işlem kimliği: {0} — bu satır yalnızca kayıt içindir.)',
    'ext.p.batch': 'Önizlemede hazırladığım {0} değişikliği uygula. Hepsini tek seferde gerçek kaynak dosyalara işle.',
    'ext.p.page': 'Sayfa: {0}',
    'ext.p.noItemSingle': '(Belirli bir öğe seçilmedi; istek bu sayfayla ilgili.)',
    'ext.p.noItem': '   Öğe: tüm sayfa',
    'ext.p.selOne': 'Önizlemede seçtiğim öğe:',
    'ext.p.selMany': 'Önizlemede seçtiğim {0} öğe:',
    'ext.p.itemOne': '   Öğe:',
    'ext.p.itemMany': '   Öğeler ({0}):',
    'ext.p.rules': 'Kurallar:',
    'ext.p.ruleStyle': '- Stil değerleri önizlemedeki canlı denemeden geliyor; bunları projenin stil yaklaşımına (Tailwind sınıfları, CSS modülleri, scoped stil vb.) uygun karşılıklarına çevir, satır içi style kullanma.',
    'ext.p.ruleDesign': '- Projenin `{0}` dosyasındaki tasarım kurallarına uy (bu konuşmada okumadıysan önce onu oku).',
    'ext.p.ruleOnly': '- Yalnızca istenenleri değiştir; derleme çıktısına (.next, .nuxt, .output, dist, node_modules) dokunma.',
    'ext.p.ruleShared': '- Öğe birden çok yerde kullanılan ortak bir bileşendeyse bunu belirt.',
    'ext.p.ruleHmr': '- Dev sunucusu hot reload ile güncelleniyor; yeniden başlatma.',
    'ext.p.ruleSummary': '- Bitince ne değiştirdiğini kısaca Türkçe özetle.',
    'ext.p.unknownPage': '(bilinmiyor)',
  },
});

const VP_KEY: Record<string, string> = { '390': 'ext.p.vp390', '1024': 'ext.p.vp1024' };

export interface PromptOptions {
  id?: string; // Panoptent işlem kimliği (geri alma için transkriptte aranır)
  pageUrl: string;
  detail: boolean; // CLI için daha fazla bağlam (HTML, stiller)
  designFile?: string; // projenin tasarım kuralları dosyası (göreli yol), varsa Claude'a hatırlatılır
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
    const how = it.source.exact ? t('ext.p.howExact') : it.source.via === 'vue' ? t('ext.p.howVue') : t('ext.p.howParent');
    L.push(`${indent}  ${t('ext.p.source', mention, loc, how)}`);
  } else {
    L.push(`${indent}  ${t('ext.p.sourceUnknown')}`);
  }
  if (it.components?.length) L.push(`${indent}  ${t('ext.p.component', it.components.join(' < '))}`);
  L.push(`${indent}  ${t('ext.p.selector', it.selector)}`);
  if (o.detail) {
    const st = Object.entries(it.styles || {}).map(([k, v]) => `${k}: ${v}`).join('; ');
    if (st) L.push(`${indent}  ${t('ext.p.styles', st)}`);
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
      return t('ext.p.text', e.from, e.to);
    case 'delete':
      return t('ext.p.delete');
    case 'image':
      if (e.saved) return t('ext.p.imageSaved', e.saved.rel, e.saved.url);
      return t('ext.p.imageUrl', e.url);
    case 'style': {
      const parts = Object.entries(e.diffs || {}).map(([k, v]) => `${k}: ${v.from || '?'} → ${v.to}`);
      if (e.classes) parts.push(t('ext.p.addClasses', e.classes));
      return t('ext.p.style', parts.join('; '));
    }
  }
}

/** İşlem kimliği satırı. Geri alma (revert.ts) yalnızca `PT-…` kimliğini arar; dil fark etmez. */
export function idMarker(id: string): string {
  return t('ext.p.marker', id);
}

export async function buildBatchPrompt(entries: Entry[], o: PromptOptions): Promise<string> {
  const marker = o.id ? `\n\n${idMarker(o.id)}` : '';
  if (entries.length === 1 && entries[0].raw) return (entries[0].text || '').trim() + marker;
  const L: string[] = [];
  const single = entries.length === 1 && entries[0].kind === 'prompt';
  if (single) {
    L.push((entries[0].text || '').trim());
    L.push('');
  } else {
    L.push(t('ext.p.batch', entries.length));
    L.push('');
  }
  L.push(t('ext.p.page', o.pageUrl));

  for (const [i, e] of entries.entries()) {
    L.push('');
    if (!single) L.push(`${i + 1}. [${t('ext.p.kind.' + e.kind)}] ${changeLine(e)}`);
    if (e.viewportOnly && VP_KEY[e.viewportOnly]) L.push(`   (${t(VP_KEY[e.viewportOnly])})`);
    if (!e.items.length) {
      L.push(single ? t('ext.p.noItemSingle') : t('ext.p.noItem'));
      continue;
    }
    if (single) L.push(e.items.length === 1 ? t('ext.p.selOne') : t('ext.p.selMany', e.items.length));
    else L.push(e.items.length === 1 ? t('ext.p.itemOne') : t('ext.p.itemMany', e.items.length));
    for (const it of e.items) L.push(...(await describeItem(it, o, single ? '  ' : '     ')));
  }

  L.push('');
  L.push(t('ext.p.rules'));
  if (o.designFile) L.push(t('ext.p.ruleDesign', o.designFile));
  if (entries.some((e) => e.kind === 'style')) {
    L.push(t('ext.p.ruleStyle'));
  }
  L.push(t('ext.p.ruleOnly'));
  L.push(t('ext.p.ruleShared'));
  L.push(t('ext.p.ruleHmr'));
  L.push(t('ext.p.ruleSummary'));
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
