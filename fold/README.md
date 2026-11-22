# Fold website

A draft of the public site: a landing page (`index.html`) and an eight-step guided tour
(`tour.html`) that embeds the TypeScript editor live.

```
node website/serve.mjs      # http://localhost:8090/  (or the "website" entry in .claude/launch.json)
```

The server serves the repository root, so the site embeds the editor from
`../Fold Editor JS/index.html` without copying it. Build the editor first (`npm run build` in
`Fold Editor JS`).

- Screenshots in `img/` are of the C++ editor (`fold_editor.exe` on `samples/webpage.fold` and
  `samples/types.fold`, and the encoding window from `Fold Editor Cpp/docs`).
- The video section is a placeholder.
- **Before hosting:** copy the editor's `index.html` and `build/` in beside the site and change
  `EDITOR` in `site.js`; replace the manifesto links (`../Manifesto/MANIFESTO.md`) with a public
  URL; fill in the footer's contact and source links.
