/*
 * Builds the bookmarklet:
 *   1. Minifies bookmarklet.src.js  -> bookmarklet.min.js
 *   2. Generates a "drag to install" page -> bookmarklet.html
 *
 * Run:  node bookmarklet/build.js   (from repo root)
 */
const fs = require("fs");
const path = require("path");
const { minify } = require("terser");

const dir = __dirname;
const srcPath = path.join(dir, "bookmarklet.src.js");
const minPath = path.join(dir, "bookmarklet.min.js");
const htmlPath = path.join(dir, "bookmarklet.html");

(async () => {
  const src = fs.readFileSync(srcPath, "utf8");

  const result = await minify(src, {
    compress: { passes: 2 },
    mangle: true,
    format: { quote_style: 1, comments: false } // single quotes -> safe to embed
  });

  if (result.error) throw result.error;

  const min = result.code.trim();
  fs.writeFileSync(minPath, min + "\n", "utf8");

  const bytes = Buffer.byteLength(min, "utf8");
  console.log(`Minified: ${bytes} bytes -> ${path.relative(process.cwd(), minPath)}`);

  // The code is single-line, has no backticks or ${ }, so it embeds safely
  // inside a template literal in the install page. The page builds the
  // final "javascript:" URL and wires it up without any HTML/URL escaping.
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Install: Cookie Popup Remover bookmarklet</title>
<style>
  body { font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif; max-width: 720px;
         margin: 40px auto; padding: 0 20px; line-height: 1.55; color: #1a1a1a; }
  h1 { font-size: 24px; }
  .bm { display: inline-block; background: #8b5a2b; color: #fff !important; text-decoration: none;
        font-weight: 700; padding: 12px 20px; border-radius: 10px; font-size: 16px;
        box-shadow: 0 3px 10px rgba(0,0,0,.2); cursor: grab; }
  .bm:hover { background: #a06a34; }
  .drop { border: 2px dashed #c9a06a; background: #faf5ee; border-radius: 12px;
          padding: 22px; text-align: center; margin: 18px 0 26px; }
  ol { padding-left: 22px; }
  code { background: #f0f0f0; padding: 2px 6px; border-radius: 5px; font-size: 13px; }
  textarea { width: 100%; height: 120px; font-family: ui-monospace, Consolas, monospace;
             font-size: 12px; border: 1px solid #ccc; border-radius: 8px; padding: 10px; box-sizing: border-box; }
  button { cursor: pointer; padding: 8px 14px; border: 0; border-radius: 8px; background: #333;
           color: #fff; font-size: 14px; }
  .muted { color: #666; font-size: 14px; }
</style>
</head>
<body>
  <h1>🍪 Cookie Popup Remover — bookmarklet</h1>
  <p>Removes cookie-consent popups <strong>and</strong> restores scrolling on pages like
     <code>vg.no</code> that lock the page until you accept.</p>

  <div class="drop">
    <p><strong>Drag this button to your bookmarks bar:</strong></p>
    <p><a class="bm" id="bmlink" href="#">🍪 Remove cookie pop-up</a></p>
    <p class="muted">Then, whenever a cookie wall blocks a page, click the bookmark.</p>
  </div>

  <h2>How to install</h2>
  <ol>
    <li>Show your browser's bookmarks bar (<code>Ctrl</code>+<code>Shift</code>+<code>B</code>).</li>
    <li>Drag the brown <strong>“🍪 Remove cookie pop-up”</strong> button onto the bookmarks bar.</li>
    <li>Open a page with a cookie wall (e.g. <code>vg.no</code>) and click the bookmark.</li>
  </ol>

  <h2>Can't drag it?</h2>
  <p class="muted">Right-click the bookmarks bar → <em>Add page / New bookmark</em>, name it
     “Remove cookie pop-up”, and paste this as the URL:</p>
  <textarea id="code" readonly spellcheck="false"></textarea>
  <p><button id="copy">Copy to clipboard</button> <span id="copied" class="muted"></span></p>

  <script>
    // Minified bookmarklet code (single line, no backticks / \${ }).
    var code = \`${min}\`;
    var url = "javascript:" + encodeURIComponent(code);
    document.getElementById("bmlink").setAttribute("href", url);
    var ta = document.getElementById("code");
    ta.value = url;
    document.getElementById("copy").addEventListener("click", function () {
      ta.select();
      navigator.clipboard.writeText(ta.value).then(function () {
        document.getElementById("copied").textContent = "Copied ✓";
      }, function () {
        document.execCommand("copy");
        document.getElementById("copied").textContent = "Copied ✓";
      });
    });
  </script>
</body>
</html>
`;

  fs.writeFileSync(htmlPath, html, "utf8");
  console.log(`Wrote install page -> ${path.relative(process.cwd(), htmlPath)}`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
