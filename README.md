# Ten cycles per integer

`index.md` is the article. Edit it, push, and GitHub Pages rebuilds the page.

| File | What it is |
|---|---|
| `index.md` | The text, in plain Markdown. Title, subtitle, author and date are in the block at the top. |
| `img/` | The figures. `cover.png` is the LinkedIn cover image. |
| `assets/style.css` | How the page looks. Colors and fonts are at the top. |
| `_layouts/post.html`, `_config.yml` | Page skeleton and Jekyll settings. |
| `src/` | Not published. `figs.mjs` draws the figures; change a number or label there and run `node src/export.mjs` (needs Google Chrome) to redo `img/`. `cmp.cpp` is the M2 comparison. |

In `index.md`:

- A joke is a quoted line starting with `//`: `> // like this`
- A figure is an image on its own line, with an italic line under it as the caption.
- A code change is a ` ```diff ` block: lines starting with `+` show green, `-` red.

## Publishing on GitHub Pages (free)

1. Create a new public repository on GitHub, for example `ten-cycles`.
2. Put this folder in it and push:
   ```bash
   git init && git add . && git commit -m "Ten cycles per integer"
   git branch -M main
   git remote add origin git@github.com:aseesing/ten-cycles.git
   git push -u origin main
   ```
3. In the repository: Settings → Pages → Build and deployment → Deploy from a branch → `main`, `/ (root)` → Save.
4. A minute later it's live at `https://aseesing.github.io/ten-cycles/`.

For your own domain, fill it in under Settings → Pages → Custom domain.
