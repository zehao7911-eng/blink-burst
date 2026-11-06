from pathlib import Path
import re

root = Path(__file__).resolve().parent

def read(name):
    return (root / name).read_text(encoding="utf-8-sig")

script = "\n".join(
    re.sub(r"^import .*;\n|^export ", "", read(name), flags=re.M)
    for name in ("core.mjs", "sdk.mjs", "app.mjs")
)
html = read("index-source.html")
html = html.replace('<link rel="stylesheet" href="./style.css">', "<style>\n"+read("style.css")+"</style>")
html = html.replace('<script type="module" src="./app.mjs"></script>', "<script>(()=>{\n"+script+"\n})();</script>")
for name in ("index.html", "standalone.html"):
    (root / name).write_bytes(html.encode())
