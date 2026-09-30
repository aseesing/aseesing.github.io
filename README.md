# aseesing.github.io

Push to `main` and GitHub Pages rebuilds https://aseesing.github.io/.

| File | What it is |
|---|---|
| `index.md` | The home page: the paragraph about me. The list of articles under it is made from `_posts/`. |
| `_posts/` | One Markdown file per article, named `YYYY-MM-DD-name.md`. Title, subtitle, author, date and URL (`permalink`) are in the block at the top. |
| `img/` | The figures. `cover.png` is the LinkedIn cover image. Link them as `/img/name.png`. |
| `assets/style.css` | How the pages look. Colors and fonts are at the top. |
| `_layouts/`, `_includes/`, `_config.yml` | Page skeletons, the live Godbolt view, and Jekyll settings. |
| `src/` | Not published. `figs.mjs` draws the figures of the ten-cycles article; change a number or label there and run `node src/export.mjs` (needs Google Chrome) to redo `img/` and `_includes/godbolt.html`. `cmp.cpp` is the M2 comparison. |

## A new article

Copy the block at the top of an existing post into `_posts/2026-10-15-something.md`, change it, and write below it.
It shows up on the home page, newest first.

In an article:

- A joke is a quoted line starting with `//`: `> // like this`
- A figure is an image on its own line, with an italic line under it as the caption.
- A code change is a ` ```diff ` block: lines starting with `+` show green, `-` red.
