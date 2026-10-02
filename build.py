"""Build: inlines CSS, JS and images into dist/index.single.html (for previews) and zips the site."""
import base64, hashlib, re, pathlib, zipfile
r = pathlib.Path(__file__).parent
MIME = {"webp": "image/webp", "svg": "image/svg+xml", "png": "image/png", "jpg": "image/jpeg", "ttf": "font/ttf"}
def data(path):
    p = r/path; return "data:%s;base64,%s" % (MIME[p.suffix[1:]], base64.b64encode(p.read_bytes()).decode())
src = (r/"index.html").read_text(); h = src
css = re.sub(r'url\((assets/[^)]+)\)', lambda m: "url(%s)" % data(m.group(1)), (r/"styles.css").read_text())
h = h.replace('<link rel="stylesheet" href="styles.css">', "<style>%s</style>" % css)
for j in ("main", "chess.bundle", "engine", "pieces", "demo"):
    h = h.replace('<script src="%s.js" defer></script>' % j, "<script>%s</script>" % (r/(j+".js")).read_text())
h = re.sub(r'((?:src|href)=")(assets/[^"]+)', lambda m: m.group(1)+data(m.group(2)), h)
# Security headers (Netlify / Cloudflare Pages `_headers`). The one inline script (theme bootstrap) is allowed by hash.
inline = re.search(r"<script>(document\.documentElement.*?)</script>", src, re.S).group(1)
sha = base64.b64encode(hashlib.sha256(inline.encode()).digest()).decode()
(r/"_headers").write_text(f"""/*
  Content-Security-Policy: default-src 'self'; script-src 'self' 'sha256-{sha}'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
/assets/*
  Cache-Control: public, max-age=31536000, immutable
""")
(r/"dist").mkdir(exist_ok=True); (r/"dist/index.single.html").write_text(h)
files = ["index.html", "privacy.html", "credits.html", "styles.css", "main.js", "chess.bundle.js", "engine.js", "pieces.js", "demo.js", "build.py", "package.json", "robots.txt", "sitemap.xml", "_headers", "tests/demo.test.js", "README.md"] + [str(p.relative_to(r)) for p in sorted((r/"assets").glob("*"))]
with zipfile.ZipFile(r/"dist/chesssrs-site.zip", "w", zipfile.ZIP_DEFLATED) as z:
    for f in files: z.write(r/f, "chesssrs-site/"+f)
print(len(h))
