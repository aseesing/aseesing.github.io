# aseesing.github.io

Push to `main` and GitHub Pages rebuilds https://aseesing.github.io/.

| File | What it is |
|---|---|
| `index.md` | The home page: the paragraph about me. The list of articles under it is made from `_posts/`. |
| `_posts/` | One Markdown file per article, named `YYYY-MM-DD-name.md`. Title, subtitle, author, date and URL (`permalink`) are in the block at the top. |
| `img/` | The figures. `cover.png` is the LinkedIn cover image. Link them as `/img/name.png`. |
| `assets/style.css` | How the pages look. Colors and fonts are at the top. |
| `_layouts/`, `_includes/`, `_config.yml` | Page skeletons, the live Godbolt view, and Jekyll settings. |
| `src/` | Not published. `export.mjs` renders every post's figures and cover (needs Google Chrome): `node src/export.mjs`, or `node src/export.mjs layout` for one figure. `lib.mjs` has the shared drawing code, `figs.mjs` the ten-cycles figures, `fix/figs.mjs` the FIX encoder ones (into `img/fix/`). A new post with figures gets a line in the list at the top of `export.mjs`. `cmp.cpp` is the M2 comparison. |

## A new article

Copy the block at the top of an existing post into `_posts/2026-10-15-something.md`, change it, and write below it.
It shows up on the home page, newest first.

In an article:

- A joke is a quoted line starting with `//`: `> // like this`
- A figure is an image on its own line, with an italic line under it as the caption.
- A code change is a ` ```diff ` block: lines starting with `+` show green, `-` red.
- A note on the side is a paragraph with `{: .side}` on the line right under it. On a wide screen it sits in the margin.
