#!/usr/bin/env python3
"""Local stand-in for src/worker.js (same two API routes + static files).
Run:  python3 dev.py [port]      Optional: PSI_KEY=... for the speed test quota."""
import json, os, sys, time, urllib.error, urllib.parse, urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'public')
UA = ('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) '
      'Chrome/130.0.0.0 Safari/537.36 SenseCheck/1.0')
KEEP = ['server', 'x-powered-by', 'x-generator', 'via', 'cf-ray', 'cf-cache-status', 'x-cache', 'content-encoding',
        'content-type', 'cache-control', 'strict-transport-security', 'last-modified', 'link', 'x-wix-request-id',
        'x-shopid', 'x-shopify-stage', 'x-litespeed-cache', 'x-varnish', 'x-pingback', 'x-redirect-by',
        'x-drupal-cache', 'x-drupal-dynamic-cache', 'x-aspnet-version', 'x-aspnetmvc-version', 'x-vercel-id',
        'x-nf-request-id', 'x-github-request-id', 'x-served-by', 'x-turbo-charged-by', 'content-length',
        'content-security-policy', 'x-frame-options', 'x-content-type-options', 'referrer-policy', 'permissions-policy']


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)

    def log_message(self, *a):
        pass

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def out(self, status, body, ctype, extra=None):
        self.send_response(status)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(body)))
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        u = urllib.parse.urlparse(self.path)
        q = urllib.parse.parse_qs(u.query)
        url = q.get('url', [''])[0]
        if u.path == '/api/fetch':
            return self.proxy(url, 'head' in q)
        if u.path == '/api/psi':
            return self.psi(url, q.get('strategy', ['mobile'])[0])
        return super().do_GET()

    def proxy(self, url, head=False):
        t0 = time.time()
        req = urllib.request.Request(url, headers={
            'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-GB,en;q=0.9'})
        try:
            res = urllib.request.urlopen(req, timeout=20)
        except urllib.error.HTTPError as e:
            res = e
        except Exception as e:
            return self.out(502, json.dumps({'error': 'unreachable', 'detail': str(e)}).encode(), 'application/json')
        ttfb = int((time.time() - t0) * 1000)
        headers = {k: res.headers.get(k)[:300] for k in KEEP if res.headers.get(k)}
        cookies = [c.split('=')[0] for c in (res.headers.get_all('Set-Cookie') or [])][:20]
        meta = {'finalUrl': res.geturl(), 'status': res.getcode(), 'ttfb': ttfb, 'headers': headers, 'cookies': cookies}
        if head:
            res.close()
            return self.out(200, json.dumps(meta).encode(), 'application/json')
        self.out(200, res.read(3000000), 'text/plain; charset=utf-8', {'X-SC-Meta': urllib.parse.quote(json.dumps(meta))})

    def psi(self, url, strategy):
        q = [('url', url), ('strategy', 'desktop' if strategy == 'desktop' else 'mobile')]
        q += [('category', c) for c in ('performance', 'accessibility', 'best-practices', 'seo')]
        if os.environ.get('PSI_KEY'):
            q.append(('key', os.environ['PSI_KEY']))
        api = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed?' + urllib.parse.urlencode(q)
        try:
            res = urllib.request.urlopen(api, timeout=120)
        except urllib.error.HTTPError as e:
            res = e
        except Exception as e:
            return self.out(502, json.dumps({'error': {'message': str(e)}}).encode(), 'application/json')
        self.out(res.getcode(), res.read(), 'application/json')


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8788
    print('SenseCheck dev server on http://127.0.0.1:%d' % port)
    ThreadingHTTPServer(('127.0.0.1', port), Handler).serve_forever()
