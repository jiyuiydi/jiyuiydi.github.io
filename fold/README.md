# Fold website

The public site, served by GitHub Pages at https://jiyuiydi.github.io/fold/. It has a landing
page (`index.html`), an eight-step guided tour (`tour.html`) that embeds the TypeScript editor
live, and the manifesto (`manifesto.html`, which draws `MANIFESTO.md`).

```
node fold/serve.mjs      # from the repository root: http://localhost:8090/fold/
```

- `editor-js/` is a copy of the TypeScript editor: its `index.html`, and `fold.js` from its
  `build/`, the single bundle that page loads. The editor's page loads `./fold.js`, not
  `./build/fold.js` as it does in the source tree. To update it, run `npm run build` in
  `Fold Editor JS` and copy the two files over.
- `MANIFESTO.md` is a copy of `Manifesto/MANIFESTO.md` from the main repository, as it was. It
  still names its sibling documents (`SPECIFICATION.md` and the others), which are not on the site.
- `.nojekyll` at the repository root stops Pages running Jekyll, which would turn
  `MANIFESTO.md` into HTML and stop serving the Markdown that `manifesto.html` reads.
- Screenshots in `img/` are of the C++ editor (`fold_editor.exe` on `samples/webpage.fold` and
  `samples/types.fold`, and the encoding window from `Fold Editor Cpp/docs`).
- The video section is a placeholder, and the footer's contact and source links are still to
  fill in.
