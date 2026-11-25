# Writing on the site

## The easy way: in the browser

Open **https://yashisacoder.github.io/YashIsACoder/write/**.

1. Pick **blog post** or **course review**, fill in the title and the rest, and write in Markdown. The preview on the right is exactly what gets published, LaTeX included.
2. Drafts save in your browser as you type (`⌘S` / `Ctrl+S` to save now).
3. Press **publish on GitHub**. GitHub opens with the file filled in. Check it and press **Commit changes**.
4. The GitHub Action rebuilds the site. The post is live about a minute later.

Optional: under "commit directly from here", paste a fine-grained token (only this repo, **Contents: Read and write**) and posts commit without leaving the page. The token stays in that browser.

## The terminal way

```sh
npm install                                   # once
npm run new -- "My post title"                # content/blog/YYYY-MM-DD-my-post-title.md
npm run new -- "COMP3331 · Networks" --kind review --course COMP3331
npm run dev                                   # build with drafts, serve http://localhost:4321
git add content && git commit -m "blog: my post" && git push
```

## Front matter

```yaml
---
title: Give both cars the same weather
date: 2026-11-22
tags: [monte-carlo, statistics]
summary: One sentence for the card and the feed.
card_math: $\hat d = (n_{10} - n_{01}) / n$   # optional, shown on the homepage card
draft: true                                     # remove to publish
---
```

Course reviews (in `content/courses/`) also take `course: COMP3331`, `term: 2026 T2`, `difficulty`, `workload`, `enjoyment` (1–10) and `again: true|false`. Add new courses to `content/courses/courses.json` so they appear in the table before you review them.

## In the body

| You write | You get |
| --- | --- |
| `$x^2$` | inline maths |
| `$$ … $$` on their own lines | display maths |
| fenced code with `cpp`, `python`, `js` or `bash` | highlighted code |
| `## Heading` | a section, listed in the side table of contents |
| `[^1]` and `[^1]: text` | footnotes |
| `::: widget paired-draws seed=7 trials=8` | a live widget (see `docs/assets/js/posts.js`) |
| fenced code with `mermaid` | a diagram (flowchart, sequence, class, state, gantt, pie), drawn in the site's colours and redrawn for dark mode |
| `![description](assets/posts/<post>/<file>.webp)` | an image. In `/write/`, paste or drop one and it uploads, resizes to 1600 px and links itself |
| `![description](assets/… "Caption")` | an image with a caption underneath |

In `/write/`, the toolbar inserts all of these, and so does the slash menu: type `/` at the start of a line and pick from the list. The ? button shows this table. Shortcuts: ⌘Z undo, ⌘⇧Z redo, ⌘F find and replace, ⌘B bold, ⌘I italic, ⌘K link, ⌘E code, ⌘S save, ⌘⇧. focus mode. Enter carries a list on; Enter on an empty item ends it. In Split view, scrolling either side moves the other, and clicking a paragraph in the preview jumps to its Markdown.

The editor is CodeMirror, bundled into `docs/assets/vendor/codemirror.js` from `scripts/vendor/codemirror-entry.js` (rebuild with esbuild if you ever need to update it).

## Where things live

```
content/blog/          blog posts (Markdown)
content/courses/       course reviews + courses.json
scripts/build.mjs      Markdown → docs/blog, docs/courses, feed.xml, homepage cards and table
scripts/make_cv.py     regenerates docs/cv.pdf (python3 scripts/make_cv.py docs/cv.pdf)
docs/                  the site GitHub Pages serves
  assets/js/projects.js   ← edit to change the projects matrix
  write/                  the in-browser editor
  labs/                   Payoff Lab and SolarRoute Studio builds
```

Palette: [Catppuccin](https://catppuccin.com) (MIT).
