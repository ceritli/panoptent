// Dev sunucusunun önüne geçen küçük bir ters proxy.
// HTML yanıtlarına seçim katmanı (overlay.js) enjekte eder, HMR websocket'lerini
// olduğu gibi geçirir. vscode modülüne bağımlı değildir, böylece ayrı test edilebilir.

import * as http from 'http';
import * as https from 'https';
import * as net from 'net';
import * as zlib from 'zlib';
import { addStrings, t, uiLang } from './i18n';

addStrings({
  en: {
    'ext.px.error': 'Proxy error: {0}',
    'ext.px.title': 'Could not reach the dev server',
    'ext.px.noServer': 'No server is running at {0}.',
    'ext.px.hint': 'Run {0} (or the matching command) in your project, then press the ↻ button above.',
  },
  tr: {
    'ext.px.error': 'Proxy hatası: {0}',
    'ext.px.title': 'Dev sunucusuna ulaşılamadı',
    'ext.px.noServer': '{0} adresinde çalışan bir sunucu bulunamadı.',
    'ext.px.hint': 'Projende {0} (veya ilgili komutu) çalıştırıp üstteki ↻ butonuna bas.',
  },
});

export const OVERLAY_PATH = '/__panoptent__/overlay.js';

export interface ProxyOptions {
  target: string; // örn. http://localhost:3000
  overlayScript: () => string; // her istekte güncel overlay kaynağı
  log?: (msg: string) => void;
}

export class DevProxy {
  private server?: http.Server;
  private target: URL;
  private sockets = new Set<net.Socket>();
  port = 0;

  constructor(private opts: ProxyOptions) {
    this.target = new URL(opts.target);
  }

  get origin(): string {
    return `http://127.0.0.1:${this.port}`;
  }

  get targetOrigin(): string {
    return this.target.origin;
  }

  setTarget(url: string) {
    this.target = new URL(url);
  }

  async start(): Promise<number> {
    const server = http.createServer((req, res) => this.handle(req, res));
    server.on('upgrade', (req, socket, head) => this.handleUpgrade(req, socket as net.Socket, head));
    server.on('connection', (s) => {
      this.sockets.add(s);
      s.on('close', () => this.sockets.delete(s));
    });
    this.server = server;
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', () => resolve());
    });
    this.port = (server.address() as net.AddressInfo).port;
    return this.port;
  }

  stop() {
    for (const s of this.sockets) s.destroy();
    this.server?.close();
  }

  private log(msg: string) {
    this.opts.log?.(msg);
  }

  /** İstek başlıklarını hedef sunucuya göre yeniden yazar. */
  private rewriteRequestHeaders(headers: http.IncomingHttpHeaders): http.OutgoingHttpHeaders {
    const out: http.OutgoingHttpHeaders = { ...headers };
    out.host = this.target.host;
    const fix = (v: string) => v.split(this.origin).join(this.target.origin);
    if (typeof out.origin === 'string') out.origin = fix(out.origin);
    if (typeof out.referer === 'string') out.referer = fix(out.referer);
    return out;
  }

  private client() {
    return this.target.protocol === 'https:' ? https : http;
  }

  private handle(req: http.IncomingMessage, res: http.ServerResponse) {
    const url = req.url || '/';

    if (url.startsWith(OVERLAY_PATH)) {
      res.writeHead(200, {
        'content-type': 'application/javascript; charset=utf-8',
        'cache-control': 'no-store',
      });
      res.end(this.opts.overlayScript());
      return;
    }

    const headers = this.rewriteRequestHeaders(req.headers);
    headers['accept-encoding'] = 'identity';

    const proxyReq = this.client().request(
      {
        protocol: this.target.protocol,
        hostname: this.target.hostname,
        port: this.target.port || (this.target.protocol === 'https:' ? 443 : 80),
        method: req.method,
        path: url,
        headers,
        rejectUnauthorized: false, // yerel https dev sertifikaları için
      },
      (proxyRes) => this.handleResponse(req, res, proxyRes),
    );

    proxyReq.on('error', (err) => {
      this.log(t('ext.px.error', err.message));
      if (!res.headersSent) {
        res.writeHead(502, { 'content-type': 'text/html; charset=utf-8' });
      }
      res.end(errorPage(this.target.origin, err.message));
    });

    req.pipe(proxyReq);
  }

  private handleResponse(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    proxyRes: http.IncomingMessage,
  ) {
    const headers: http.OutgoingHttpHeaders = { ...proxyRes.headers };
    // iframe içinde açılabilmesi ve script enjekte edilebilmesi için
    delete headers['x-frame-options'];
    delete headers['content-security-policy'];
    delete headers['content-security-policy-report-only'];

    if (typeof headers.location === 'string') {
      headers.location = headers.location.split(this.target.origin).join(this.origin);
    }

    const type = String(proxyRes.headers['content-type'] || '');
    const isHtml = type.includes('text/html') && req.method === 'GET';

    if (!isHtml) {
      res.writeHead(proxyRes.statusCode || 200, headers);
      proxyRes.pipe(res);
      return;
    }

    const chunks: Buffer[] = [];
    proxyRes.on('data', (c: Buffer) => chunks.push(c));
    proxyRes.on('end', () => {
      let body = Buffer.concat(chunks);
      const enc = String(proxyRes.headers['content-encoding'] || '').toLowerCase();
      try {
        if (enc === 'gzip') body = zlib.gunzipSync(body);
        else if (enc === 'br') body = zlib.brotliDecompressSync(body);
        else if (enc === 'deflate') body = zlib.inflateSync(body);
      } catch {
        // açılamadıysa olduğu gibi gönder
        res.writeHead(proxyRes.statusCode || 200, headers);
        res.end(Buffer.concat(chunks));
        return;
      }
      const html = injectOverlay(body.toString('utf8'));
      const out = Buffer.from(html, 'utf8');
      delete headers['content-encoding'];
      delete headers['transfer-encoding'];
      headers['content-length'] = String(out.length);
      // Gövdeyi UTF-8 olarak yeniden yazdık; karakter seti belirtilmemişse ekle
      if (!/charset=/i.test(type)) headers['content-type'] = (type || 'text/html') + '; charset=utf-8';
      headers['cache-control'] = 'no-store';
      res.writeHead(proxyRes.statusCode || 200, headers);
      res.end(out);
    });
    proxyRes.on('error', () => res.end());
  }

  private handleUpgrade(req: http.IncomingMessage, socket: net.Socket, head: Buffer) {
    const headers = this.rewriteRequestHeaders(req.headers);
    const proxyReq = this.client().request({
      protocol: this.target.protocol,
      hostname: this.target.hostname,
      port: this.target.port || (this.target.protocol === 'https:' ? 443 : 80),
      method: req.method,
      path: req.url,
      headers,
      rejectUnauthorized: false,
    });

    proxyReq.on('upgrade', (proxyRes, proxySocket, proxyHead) => {
      const lines = [`HTTP/1.1 ${proxyRes.statusCode} ${proxyRes.statusMessage}`];
      for (let i = 0; i < proxyRes.rawHeaders.length; i += 2) {
        lines.push(`${proxyRes.rawHeaders[i]}: ${proxyRes.rawHeaders[i + 1]}`);
      }
      socket.write(lines.join('\r\n') + '\r\n\r\n');
      if (proxyHead && proxyHead.length) socket.write(proxyHead);
      if (head && head.length) proxySocket.write(head);
      proxySocket.pipe(socket);
      socket.pipe(proxySocket);
      const kill = () => {
        socket.destroy();
        proxySocket.destroy();
      };
      proxySocket.on('error', kill);
      socket.on('error', kill);
      proxySocket.on('close', kill);
      socket.on('close', kill);
    });

    proxyReq.on('response', (r) => {
      // sunucu upgrade'i kabul etmedi
      socket.end(`HTTP/1.1 ${r.statusCode} ${r.statusMessage}\r\n\r\n`);
    });
    proxyReq.on('error', () => socket.destroy());
    proxyReq.end();
  }
}

export function injectOverlay(html: string): string {
  const tag = `<script src="${OVERLAY_PATH}" data-panoptent></script>`;
  if (html.includes(OVERLAY_PATH)) return html;
  // Belgenin en sonuna ekliyoruz: React/Vue hidrasyonunun yönettiği <head>
  // ağacına dokunmamak için. Tarayıcı bunu <body>'nin sonuna taşır.
  return html + tag;
}

function errorPage(target: string, msg: string): string {
  return `<!doctype html><html lang="${uiLang()}"><meta charset="utf-8"><body style="font-family:system-ui;padding:40px;color:#444">
<h2 style="margin:0 0 8px">${escapeHtml(t('ext.px.title'))}</h2>
<p>${t('ext.px.noServer', `<code>${escapeHtml(target)}</code>`)}</p>
<p>${t('ext.px.hint', '<code>npm run dev</code>')}</p>
<p style="color:#999;font-size:12px">${escapeHtml(msg)}</p></body>`;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}
