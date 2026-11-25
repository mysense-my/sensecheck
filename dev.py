#!/usr/bin/env python3
"""Local stand-in for src/worker.js: same API routes plus static files, for machines without Node.
Run:  python3 dev.py [port]      Optional: PSI_KEY=... for the speed test quota.

There is no real login here. A "Local preview" switch in the sidebar lets you pretend to be one of three colleagues
(one is admin) so personal dashboards can be tried. Scans are kept in .local/scans.json. None of this exists on the
real Worker, where Cloudflare Access supplies the signed-in email."""
import json, os, sys, threading, time, urllib.error, urllib.parse, urllib.request, uuid
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, 'public')
STORE = os.path.join(HERE, '.local', 'scans.json')
USERS = ['colleague.a@local.test', 'colleague.b@local.test', 'admin@local.test']
ADMINS = ['admin@local.test']
LOCK = threading.Lock()
SAMPLE_REVIEW = {'impression': 'The first screen is busy: a rotating banner, three different fonts and a menu with a lot of items all compete for attention, so it is hard to tell what the business does.',
                 'dated': 'dated',
                 'points': [{'area': 'First screen', 'saw': 'The banner rotates through several messages and none of them says what the company offers.', 'do': "We'd replace it with one strong photo and a single clear line."},
                            {'area': 'Colours', 'saw': 'Dark blue, bright red and green are all used for buttons, so nothing stands out as the main action.', 'do': "We'd pick one button colour and keep the rest calm."},
                            {'area': 'Photos', 'saw': 'Most pictures are small and look like stock images.', 'do': "We'd use larger, real photos of the team and the work."},
                            {'area': 'On phones', 'saw': 'The text is tight against the edges and the buttons sit close together.', 'do': "We'd give everything more breathing room on small screens."}],
                 'pitch': 'Your site has all the right information, it just makes people work to find it. We can make the first screen say what you do in three seconds.'}
KEEP_HOURS = 24  # saved scans are removed after this long, as on the real Worker
UA = ('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) '
      'Chrome/130.0.0.0 Safari/537.36 SenseCheck/1.0')
KEEP = ['server', 'x-powered-by', 'x-generator', 'via', 'cf-ray', 'cf-cache-status', 'x-cache', 'content-encoding',
        'content-type', 'cache-control', 'strict-transport-security', 'last-modified', 'link', 'x-wix-request-id',
        'x-shopid', 'x-shopify-stage', 'x-litespeed-cache', 'x-varnish', 'x-pingback', 'x-redirect-by',
        'x-drupal-cache', 'x-drupal-dynamic-cache', 'x-aspnet-version', 'x-aspnetmvc-version', 'x-vercel-id',
        'x-nf-request-id', 'x-github-request-id', 'x-served-by', 'x-turbo-charged-by', 'content-length',
        'content-security-policy', 'x-frame-options', 'x-content-type-options', 'referrer-policy', 'permissions-policy',
        'cf-mitigated', 'x-sucuri-id', 'x-sucuri-block', 'x-iinfo', 'x-cdn', 'x-amz-cf-id', 'x-amzn-waf-action',
        'www-authenticate', 'retry-after', 'x-wp-total', 'x-wp-totalpages']


def load():
    try:
        return json.load(open(STORE))
    except Exception:
        return []


def save(rows):
    os.makedirs(os.path.dirname(STORE), exist_ok=True)
    json.dump(rows, open(STORE, 'w'))


def summary(r):
    g = lambda o, k, d='': (o or {}).get(k) or d
    return {'domain': r.get('domain'), 'date': r.get('date'), 'health': {'score': (r.get('health') or {}).get('score')},
            'verdict': {'tone': g(r.get('verdict'), 'tone', 'info'), 'label': g(r.get('verdict'), 'label')},
            'fit': {'tone': g(r.get('fit'), 'tone', 'info'), 'verdict': g(r.get('fit'), 'verdict')},
            'stack': {'platform': {'name': g((r.get('stack') or {}).get('platform'), 'name', 'Not detected')}}}


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)

    def log_message(self, *a):
        pass

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def out(self, status, body, ctype='application/json', extra=None):
        if not isinstance(body, bytes):
            body = json.dumps(body).encode()
        self.send_response(status)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(body)))
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(body)

    def me(self):
        c = dict(p.strip().split('=', 1) for p in (self.headers.get('Cookie') or '').split(';') if '=' in p)
        email = urllib.parse.unquote(c.get('sc_dev_user', ''))
        email = email if email in USERS else USERS[0]
        return email, email in ADMINS

    def route(self, method):
        u = urllib.parse.urlparse(self.path)
        q = urllib.parse.parse_qs(u.query, keep_blank_values=True)
        email, admin = self.me()
        if u.path == '/api/me':
            return self.out(200, {'email': email, 'admin': admin, 'store': True, 'local': True, 'users': USERS, 'ai': True})
        if u.path == '/api/design-review' and method == 'POST':
            # No AI call is made locally. This is a made-up sample so the screen can be checked.
            self.rfile.read(int(self.headers.get('Content-Length', 0)))
            time.sleep(1.5)
            return self.out(200, {'sample': True, 'review': SAMPLE_REVIEW})
        if u.path == '/api/dev-login' and method == 'POST':
            who = q.get('as', [''])[0]
            if who not in USERS:
                return self.out(400, {'error': 'unknown user'})
            return self.out(200, {'ok': True}, extra={'Set-Cookie': 'sc_dev_user=%s; Path=/; SameSite=Lax' % urllib.parse.quote(who)})
        if u.path == '/api/scans' or u.path.startswith('/api/scans/'):
            return self.scans(method, u.path[len('/api/scans/'):] if len(u.path) > len('/api/scans/') else '', 'all' in q, email, admin)
        if method != 'GET':
            return self.out(405, {'error': 'GET only'})
        url = q.get('url', [''])[0]
        if u.path == '/api/fetch':
            return self.proxy(url, 'head' in q)
        if u.path == '/api/psi':
            return self.psi(url, q.get('strategy', ['mobile'])[0])
        if u.path == '/api/crux':
            return self.crux(url, q.get('form', ['phone'])[0])
        return super().do_GET()

    def do_GET(self):
        self.route('GET')

    def do_POST(self):
        self.route('POST')

    def do_DELETE(self):
        self.route('DELETE')

    def scans(self, method, sid, want_all, email, admin):
        with LOCK:
            rows = load()
            fresh = [r for r in rows if time.time() - r.get('created_at', time.time()) < KEEP_HOURS * 3600]
            if len(fresh) != len(rows):
                rows = fresh
                save(rows)
            if not sid and method == 'GET':
                mine = [r for r in rows if (want_all and admin) or r['email'] == email]
                return self.out(200, {'scans': [dict(summary(r['result']), id=r['id'], by=r['email']) for r in reversed(mine)]})
            if not sid and method == 'POST':
                try:
                    r = json.loads(self.rfile.read(int(self.headers.get('Content-Length', 0))))
                    assert isinstance(r.get('domain'), str) and r.get('health') and r.get('verdict') and isinstance(r.get('issues'), list)
                except Exception:
                    return self.out(400, {'error': 'bad request'})
                for k in ('mobile', 'desktop'):
                    if isinstance((r.get('psi') or {}).get(k), dict) and r['psi'][k].get('shot'):
                        r['psi'][k]['shot'] = ''
                r.pop('id', None); r.pop('by', None)
                new = str(uuid.uuid4())
                rows.append({'id': new, 'email': email, 'created_at': time.time(), 'result': r})
                save(rows)
                return self.out(200, {'id': new})
            row = next((r for r in rows if r['id'] == sid), None)
            if sid and method in ('GET', 'DELETE'):
                if not row:
                    return self.out(404, {'error': 'not found'})
                if row['email'] != email and not admin:
                    return self.out(403, {'error': 'forbidden'})
                if method == 'GET':
                    return self.out(200, dict(row['result'], id=sid, by=row['email']))
                save([r for r in rows if r['id'] != sid])
                return self.out(200, {'ok': True})
        return self.out(405, {'error': 'not allowed'})

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
            return self.out(502, {'error': 'unreachable', 'detail': str(e)})
        ttfb = int((time.time() - t0) * 1000)
        headers = {k: res.headers.get(k)[:300] for k in KEEP if res.headers.get(k)}
        cookies = [c.split('=')[0] for c in (res.headers.get_all('Set-Cookie') or [])][:20]
        meta = {'finalUrl': res.geturl(), 'status': res.getcode(), 'ttfb': ttfb, 'headers': headers, 'cookies': cookies}
        if head:
            res.close()
            return self.out(200, meta)
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
            return self.out(502, {'error': {'message': str(e)}})
        self.out(res.getcode(), res.read(), 'application/json')

    def crux(self, url, form):
        if not os.environ.get('PSI_KEY'):
            return self.out(400, {'error': 'no key'})
        o = urllib.parse.urlsplit(url)
        body = json.dumps({'origin': '%s://%s' % (o.scheme, o.netloc), 'formFactor': 'DESKTOP' if form == 'desktop' else 'PHONE',
                           'metrics': ['largest_contentful_paint', 'interaction_to_next_paint', 'cumulative_layout_shift']}).encode()
        req = urllib.request.Request('https://chromeuxreport.googleapis.com/v1/records:queryHistoryRecord?key=' + urllib.parse.quote(os.environ['PSI_KEY']),
                                     data=body, headers={'Content-Type': 'application/json'})
        try:
            res = urllib.request.urlopen(req, timeout=30)
        except urllib.error.HTTPError as e:
            res = e
        except Exception as e:
            return self.out(502, {'error': str(e)})
        self.out(res.getcode(), res.read(), 'application/json')


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8788
    print('SenseCheck dev server on http://127.0.0.1:%d' % port)
    ThreadingHTTPServer(('127.0.0.1', port), Handler).serve_forever()
