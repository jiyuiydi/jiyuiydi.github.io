# The Fold Manifesto
 
Distilled from the dissertation *Infra: A New Infrastructure for Human-Readable Data*
(Chris Hall), its unpublished sections, the SPLASH'17 Onward! material, and five prior
implementations.
 
This document replaces the dissertation as the project's standing context. It carries the
motivation that should shape taste during implementation, the editor design that makes the
whole thing legible, a staged implementation plan, and the long-range roadmap.
 
| Document | Contains |
|---|---|
| **MANIFESTO.md** (this) | Why, what the editor is, how to build it, why now, where it goes |
| `SPECIFICATION.md` | The encoding and semantics that must be standardized |
| `OPEN-QUESTIONS.md` | Every gap, ambiguity and contradiction, with proposed resolutions |
| `PRIOR-IMPLEMENTATIONS.md` | What has been built, how far each got, where each stopped |
| `figures/` | All 178 dissertation figures, with an annotated index |
 
The project was called **Infra** until now and is called **Fold** here; the names are
interchangeable — §0 explains the change and what was deliberately left unrenamed.
 
---
 
## 0. A note on the name
 
This project was called **Infra** for a decade — in the dissertation, in the SPLASH'17
Onward! paper, and in every prior implementation. It is called **Fold** in these documents.
 
**The two names are interchangeable.** They refer to the same project, the same encoding,
and the same design. Wherever you meet `Infra` — in the dissertation, in the source trees
(`infra-java-2.0`, `infra-js-1.0`, `org.infra_structure`), in class names like
`InfraEncoding`, in file names, or in a passage quoted here — read it as `Fold`. Historical
names are deliberately left unrenamed in these documents, because renaming them would make
the sources unfindable.
 
**Why the change.** "Infra" is unsearchable: it collides with infrastructure-as-code, infra
teams, Infura, and infrared. It is also a prefix rather than a word, so it permanently reads
as missing its second half. The generic-category bid — claiming a word like *Infra* or
*Data* — only pays off if you win, and until you do it makes the project impossible to
find during exactly the phase when discovery is word-of-mouth. Note that the formats which
genuinely did become invisible infrastructure — UTF-8, JSON, SQL, HTTP — none of them
claimed the generic word. Invisibility followed from ubiquity, not the reverse.
 
"Fold" carries the thesis instead. The origami argument in §2.3 is the project's actual
success criterion, not an illustration, and *flat sheet → folded structure* is literally
what this does to text. It is a real word, short, and concrete. Most importantly **it
verbs** — *fold it*, *unfold this*, *a folded document* — and names that become verbs are
the ones that truly recede into the background. "Infra" cannot verb. The file extension is
`.fold`.
 
**One collision, accepted with open eyes.** `fold` is heavily overloaded in functional
programming — foldl/foldr, reduce, catamorphism — and the first audience for this work is
precisely the room where that is the primary meaning. This is a nuisance rather than a
failure: formats and functions do not compete in conversation for more than a sentence, and
the collision partly pays for itself, since *fold* and *unfold* are already the right words
for the editor's collapse-and-expand gesture. If it ever proves worse than expected,
**Crease** and **Folio** keep the metaphor and dodge the catamorphism.
 
**Type names are a separate question, and were already settled.** The library vocabulary
stays as the prior implementations had it: `Data`, `List`, `Keyed`, `Patch`, `Metadata`,
`Text`, `Bytes`, `Quantity`, `Symbol`. A programmer types those all day and never types the
project name once, so the "worthy of a universal term" instinct is satisfied exactly where
it belongs — at the type level. `Fold` is the brand, the extension, and the word said out
loud; `Data` remains the root type.
 
## 1. The thesis in one page
 
Early computers talked to people through electromechanical typewriters. That accident is
still load-bearing: printable character codes remain the sole building blocks of source
code, command lines, form fields, and every format we call "human-readable" — HTTP, URL,
HTML, JSON, CSS.
 
Meanwhile every CPU and every runtime data structure uses binary quantities to give
information structure, because quantities permit random access. So computing runs two
incompatible encoding paradigms and burns an enormous, permanent, invisible tax converting
between them: parsers one way, renderers the other.
 
**Quantitative syntax** puts run-lengths up front. You can skip a subtree without reading
it. Structure is not content-sensitive. Nothing needs escaping. But it requires machinery
to author, because lengths must be kept in sync with every edit — which a typewriter could
never do and a piece of paper certainly cannot.
 
**Qualitative syntax** uses reserved symbols to signal structure. A sentence runs to a
period, a C string to a null, a block to a matching brace. Every byte must be scanned,
because any byte might be a control character. Designating any character as a metacharacter
punches a hole in the content space, which then needs escape sequences, which are
themselves a readability cost — ironically, since readability is why the format was
textual in the first place.
 
These are not two points on a spectrum. They are complements, with mutually exclusive
properties, and the reason everything is textual on the human side is a hardware
constraint that expired decades ago.
 
**Fold is the observation that a smart editor is exactly the machinery quantitative syntax
was missing.** An editor that updates segment lengths on every keystroke makes a binary,
parsed, random-access encoding directly authorable by a person — with a keyboard, in a
text field, at the speed of typing.
 
So: **Fold has no textual representation, and is designed to be read and written by
people.** Both, without compromise. It is a binary metaformat that intends to occupy the
role UTF-8 occupies today.
 
Three base types no other metaformat has, and they are the whole argument:
 
- **Metadata** — any element, including metadata itself, recursively, may carry arbitrary
  markup keyed by language. Extensibility becomes a primitive.
- **Patch** — a program that evaluates to a data structure. References, graphs,
  abstraction, and computation, all at the encoding layer.
- **Free** — unallocated gaps at byte granularity. Which makes a Fold buffer a heap.
## 2. Motivation, as it bears on design decisions
 
Only the parts that should change what gets built.
 
### 2.1 Human-readability is a property of ubiquity, not of bits
 
There is nothing intrinsically readable about UTF-8. The chain runs
electrons → bits → character codes → glyphs → pixels → photons, and every link is
software. "Human-readable" means, in practice, *an encoding a text editor will render*, and
that status was earned by having an install base everywhere.
 
**Therefore:** any encoding general enough to warrant equal ubiquity can earn the same
status. The bar is not "is it legible as bytes" — nothing is. The bar is **is it worth
installing everywhere**. Design decisions should be judged against that, which means Fold
must be at least as good as text at being text, before it is allowed to be better at
anything else. A feature that improves structured data at the cost of the plain-text case
is a bad trade, always.
 
### 2.2 Computing should be self-similar all the way down
 
Alan Kay's complaint: we take a general-purpose machine and assemble it out of less
powerful building blocks, then simulate old media with it. Each of the three media
revolutions — Text, GUI, DOM — left an incomplete medium propped up by another. Text has
no structure or abstraction. GUI abstractions are imposed top-down by an application and
cannot travel with the data when it leaves. The DOM is itself built out of UTF-8 formats
and is designed for consumption rather than authorship.
 
**Therefore:** self-similarity is a design criterion with teeth. Whenever a mechanism could
be expressed in Fold itself or as a special case in the implementation, prefer Fold.
Schemas are Fold trees, not a schema language. Patch instructions are Fold nodes, not a
bytecode. Metadata languages are named by Fold structures, not by strings with dots in
them. Every escape from this rule is a place the medium stops being inspectable, and those
places compound.

§3.6 names what this criterion produces once it is applied to the editor as well as to the
data — **edit-oriented programming**, in which a Patch program is a user of an editor — and
lists the four mechanisms that turned out to be one mechanism seen at different scales. It
is the most useful form of this section to carry into an implementation, because it says
where to look rather than only what to prefer.
 
### 2.3 Computational literacy does not earn proportional utility
 
Alan Kay named Smalltalk for the day programming would be small talk. Forty-five years
later, casual computational fluency buys you nothing in your daily use of software. An app
has no inlet for it. Interfaces cannot be broken open while running to reveal their
material. Source code is not the answer — it is an X-ray of DNA, and it says nothing about
live state.
 
The origami test: when you are handed an origami crane you can learn to make one by
*unfolding* it. The medium holds the memory of its own construction, whether or not the
folder intended it, and the value of unfolding scales smoothly from idle curiosity to
literal mimicry to expert modification. A child with access to cars can become a decent
self-taught mechanic; a child with an iPad and unlimited App Store credit cannot become a
self-taught developer. **Software should unfold.**
 
**Therefore:** the goal is a landscape where partial fluencies stand on their own
dividends — where an investment can stop anywhere without having been wasted. In practice
this means every abstraction must be openable in place, at the point of use, by the same
gesture, without changing tools or leaving the document. If opening a thing requires a
different application, the design has failed.
 
### 2.4 Text discourages saying more than the minimum
 
Most data has context that would help — provenance, units, intent, presentation, access
history. In a textual format, everything you add lands in the reader's face, so formats
are designed impoverished on purpose. `ls` needs a `-l` flag precisely because detail
cannot be present-but-collapsed.
 
**Therefore:** metadata is not a feature, it is the point. It must cost nothing when
absent, be invisible until wanted, be structurally distinguishable from data at the
encoding layer so no parser is ever confused by it, and pass intact through processing
stages that do not understand it. Any design that makes metadata expensive, or that makes
unrecognized metadata a failure, has broken the central bargain.
 
### 2.5 Structured editors fail when they forbid invalid states
 
The most important negative lesson in the whole dissertation, and the one most likely to be
violated by a well-meaning implementer.
 
Structured editors have been attempted since the 1970s — Emily, Gandalf, Centaur; recently
Subtext, TouchDevelop, MPS. The documented cause of their usability failure is that they
constrain edits so the document is never grammatically invalid. But the path of least
resistance for a compound edit routinely passes *through* invalid states. Forbidding the
intermediate forbids the path. Source-Code-In-Database systems are worse still: an invalid
program has no representation at all.
 
**Therefore:** Fold's metaformat has no grammar to violate. Validity is a `schema`-layer
opinion, advisory by default, enforced only when a user opts in. **Never make an invalid
state unrepresentable at the encoding layer.** When in doubt, allow it and let the schema
complain.
 
### 2.6 The taste checklist
 
When a design decision is genuinely ambiguous, prefer the option that:
 
1. keeps the plain-text case as cheap and as familiar as plain text;
2. expresses the mechanism in Fold rather than in the implementation;
3. costs nothing when the feature is unused;
4. lets an unaware reader pass the data through undamaged;
5. permits an invalid or half-finished state to exist;
6. can be authored by demonstration rather than by writing code;
7. adds a degree of freedom the user may ignore, rather than one they must manage;
8. spends bytes rather than spending a base type — there are only three type slots left.
---
 
## 3. The editor
 
The encoding and the editor are one artifact. Neither is interesting alone: the encoding
without the editor is another binary metaformat, and the editor without the encoding is
another structured editor. **The editor is the human-readability layer**, and it is what
makes the claim in §2.1 collectible.
 
### 3.1 What it must be
 
A Fold editor plays the role text editors and text-field widgets play — the *whole* role,
including the boring end of it. Its ambition is to be the thing you get when you tap an
input box.
 
The parity test, which everything else is subordinate to: **type "The quick brown fox
jumped over the lazy dog" and it must look exactly like it does in a text editor.** Behind
the glass it is nine UTF-8 segments in a list. On the glass it is a sentence. The default
inter-element margin is the width of a space character, which is why this works.

**And the no-chrome rule that falls out of it is scoped to exactly that case — Chris,
2026-09-08, correcting a reading the implementation had let harden.** The rule is *no chrome
for the plain-text case*: a person typing the equivalent of plain text must not be shown a
gutter, a history panel, a toolbar or a dirty marker, because none of that appears in the
thing they are being asked to compare against. **As soon as a reader is willing to express
structure, chrome is fine.** Minimalism is still a taste worth keeping — it is taste 1 and
taste 3 pointing the same way — but it is a preference at that point and not a prohibition,
and there has to be enough of it for what is on the glass to be understandable. Read
absolutely, the rule would forbid the parts of the editor that make structure worth having,
which is the opposite of what it is for: it protects the boring end of §3.1's ambition, and
it does not govern the interesting end.
 
From Fold's perspective, a traditional text editor is just an editor whose cursor is
locked at the character level, edits only String objects, and has tunnel vision on one
string at a time.
 
### 3.2 The hierarchical cursor
 
The one genuinely new interaction primitive. Text editors have a cursor that moves left
and right. Fold's also moves **in** and **out**.
 
Descend into a list and the arrow keys move between its children instead of its siblings.
Descend again and you are editing characters in the familiar way. Delete at word level
deletes a word; delete at character level deletes a character. The concept has to be
learned once and then applies to everything, at every depth, forever — which is the
"amortized learning curve" argument in miniature.
 
The Patch virtual cursor is the *same* cursor, which is why programs can be recorded from
edits (§3.6).
 
### 3.3 Typing structure
 
- **Spacebar creates a new segment** instead of writing a space character. Normal typing
  therefore tokenizes sentences as you go. Shift+space types a literal space.
- **Numbers convert on the fly**, when and only when the conversion survives a round trip.
  `-1` becomes a one-byte Integer immediately; `-1000` stays an Integer and picks up
  localized digit grouping; `-1000.` falls back to UTF-8, because `"-1000."` does not
  round-trip; `-1000.5` promotes to Floating Point. Grisu3/Dragon4 do the shortest-
  representation test. This is editor policy, not spec (`OPEN-QUESTIONS.md` C2).
- **Structure is authored, not declared.** Nesting, keying, metadata and references are all
  keystrokes, not syntax.
The keymap from the prototype (recorded in the SPLASH scratch file, never published) is the
starting point: page-up/down for cursor scope, escape to select metadata, shift+arrows for
contiguous selection, ctrl+a for all siblings, enter for vertical layout, tab to cycle
faces, space to create, shift+space for a literal space, alt+arrows to move elements,
ctrl+c/ctrl+v to create a reference, ctrl+E / ctrl+e to un-evaluate and re-evaluate a
Patch, ctrl+s to commit a Patch result, ctrl+enter to push in, ctrl+page-up to pull back.
 
### 3.4 Showing the primitives
 
Structure is drawn, not spelled. A List is a thin overline spanning its items; when it
wraps or lays out vertically it becomes a full outline. A Keyed List renders either as
parentheses or as `A:B` — the colon form reads best at exactly two items, the parenthesis
form everywhere else, and since it is purely presentational the user can switch at will.
A Patch has a dashed outline; a Patch *result* has a subtle drop shadow. Quantities are
monospaced and strings are not, exactly as spreadsheets distinguish them, which also makes
decimal points line up in tables.
 
Byte arrays get a choice of lens: hexadecimal for editing, Chroma-Hash for fast visual
comparison, Data Matrix for a compact glyph that signals type and permits equality
judgement without decoding. Runtime-only values need glyphs too — an Ouroboros for circular
self-reference, a **button** for a Side-Effect object, a **dropdown** for a Choice Point.
 
That last pair matters more than it looks: a pending mutation and a toolbar button are the
same object, and a sum type and a dropdown are the same object. The UI is not a metaphor
for the semantics; it is a rendering of it.
 
### 3.5 Faces
 
Any subtree can be displayed more than one way, and the user cycles. Any tree can be a
table. A three-byte array tagged `format: RGB` becomes a color swatch and a color picker.
A node with `ID` metadata can render as its name (drawn as a luggage tag, so the label is
not mistaken for the value). An encoding view shows live hex beside the document.
 
The prototype editors carry 14 and 8 face classes respectively — far ahead of the
dissertation's prose on the subject, which is a stub. Build the face model from the code
(`OPEN-QUESTIONS.md` C4).
 
### 3.6 Editing is programming
 
The design decision that ties the system together: **the Patch opcode set is the editor's
edit operations.**

**Read backwards, that sentence is the whole paradigm, and it is worth naming: this is
*edit-oriented programming*.** A Patch program is a *user of an editor*. It holds a cursor,
it navigates, it edits, and what it leaves behind is a record of what it did. That identity
is not a metaphor laid over the design — it is the reason four things in this system are one
mechanism apiece instead of two:

- **One cursor.** The editor's hierarchical cursor and the Patch's virtual cursor are the
  same object (§3.2, `SPECIFICATION.md` §4.2), because there is only one kind of thing doing
  the moving.
- **The session is a Patch.** A person's own editing is a program, recorded as it happens.
  So the outermost editor is *already* in record mode and always has been, and a document is
  what its session Patch evaluates to.
- **The overlay is unsaved changes.** A Patch's edits accumulate against a copy and the
  source is untouched (`SPECIFICATION.md` §4.7) — which is precisely what an editor holding a
  modified buffer is.
- **`sync` is save.** A separate, deliberate act pushes accumulated changes back to the
  source, and until it is taken nothing outside has changed (§4.6). A Side-Effect object is
  the pending write, and it is inert until a person accepts it.

The structure is **fractal**: at every scale — a person typing, a Patch running, a Patch
running inside a Patch — those four things are true in the same way. The practical rule that
falls out is §2.2's self-similarity criterion with a sharper edge: *before building a
mechanism at one scale, look for it at the others.* Every one of the four above was found
that way rather than designed twice.
 
Consequences that fall out of that one alignment, with no additional machinery:
 
- **Copy/paste creates a reference.** Select, copy, select, paste — the pasted thing is a
  live second view, and the path back is computed automatically. Edit the original and both
  update. Almost nobody needs to see a Patch instruction.
- **Editing a Patch's result records a program.** An edit that would have mutated instead
  appends instructions. The architecture is one rule: an edit propagates up the view tree,
  and if it exits the root it applies, and if it meets a Patch it converts. **Recording is
  the default rather than a mode that is entered** (Chris, 2026-09-08) — which is the
  framing above paying out, because the root already behaves this way: editing a document
  records into the session Patch rather than writing a file, and ctrl+s is what pushes it to
  source. A reference that wrote straight through to its fact would be the one place in the
  system where a mutation happens with no acceptance step, and §4.6 is unambiguous that
  there is no such place. **Writing through is not a mode; it is a `sync` on the reference** —
  the Side-Effect it evaluates to carries exactly "the edits the Patch made to the data it
  referenced", which is §4.6's own sentence. What an editor still owes the reader is
  disclosure, not a switch: that the value being typed into is a reading, and that it has now
  forked from its fact.
- **Undo is a Patch chain.** Removable out of chronological order, which ordinary undo
  stacks cannot do.
- **A macro is a Patch with its reference swapped.** The same edits replay against different
  source material.
- **Programming by example.** Edit a result in a way that discards what it referenced, and
  the system reads that as an input/output example, records a `case()`, and searches the
  function library in the background for something that satisfies all recorded cases. One
  match: apply silently. Several: ask, ideally by synthesizing a discriminating input.
The user never chose to program. They copied, pasted, and edited.
 
### 3.7 The browser is a special case of the editor
 
A Fold editor that reacts to `CSS` metadata is a web browser. There is no second artifact
and no rendering pipeline: the true comparison is Fold-in-an-editor against *raw HTML in a
text editor*, and Fold wins that comparison outright — property names may contain spaces,
colors are three binary bytes instead of seven characters of `#ff9212`, values may repeat,
attributes may have attributes, and parsing happened at author time.
 
Hide the metadata layers and the same document renders as the browser output. **View source
and view page are the same view at different cursor depths.** This is the concrete form of
"web browsers don't need to be distinct from text editors" (§6.1).
 
---
 
## 4. What to build, in what order
 
### 4.1 Two targets, one contract
 
**TypeScript / browser — proves the experience.** The claims that need proving are all
felt: does the parity test hold, does the hierarchical cursor learn easily, does copy/paste
referencing feel like magic or like a trap, is programming-by-demonstration convincing.
None of these can be settled by argument. The browser is the right host because iteration
is fastest, distribution is trivial, and the DOM/CSS comparison is available for direct
side-by-side demonstration.
 
**C++ — proves the performance.** The claims that need proving are all measured: in-place
modification of large files with Free-space management, Fold as a runtime heap, zero-copy
reads, byte-efficiency parity with Protocol Buffers, incremental decoding without
allocation storms. These are the claims that make Fold plausible as infrastructure rather
than as a demo, and they cannot be shown in a browser.
 
**The contract between them is a shared conformance vector suite**, and it should exist
before the second implementation starts rather than after (`OPEN-QUESTIONS.md` D5). Byte
strings paired with expected trees; Patch programs paired with expected results; malformed
inputs paired with expected classifications. This is the cheapest insurance available and
the prior implementations did not have it.
 
### 4.2 Stage 0 — Skeleton
 
*The smallest thing that is recognizably Fold. No editor, no evaluation.*
 
- Header codec: type nibble, size nibble, size-15 overflow, Dlugosz VLI (decide the
  required subset per **A6** and write it down).
- Leaves: Free, Byte Array, UTF-8, Integer, Floating Point, Bit Array, Nibble, Symbol.
- Containers: List, Keyed List, Metadata. **Not** Patch, **not** Continuation.
- Metadata association rules, including the shorthand forms.
- Singleton unwrapping (after deciding **A7**).
- Decode to tree, encode from tree, round-trip.
- **Conformance vectors, from day one.** Including the 18-byte `fish` example from
  `SPECIFICATION.md` §8.1 as vector zero.
Resolve first: **A1** (type 0xA), **A2** (Symbol table — it renumbers, so settle it before
any bytes exist), **A6** (VLI subset).
 
Done when: the `fish` example round-trips byte-identically in both languages, and a zeroed
buffer parses as an empty document.
 
### 4.3 Stage 1 — Proof of concept (TypeScript first)
 
*The UX claim, and nothing else. This is the stage that decides whether the vision is
real.*
 
- Free-form tree editing with the hierarchical cursor: in, out, left, right, at every depth
  down to characters.
- Spacebar tokenization; shift+space literal.
- Number promotion ladder with round-trip testing.
- List overline, Keyed List in both styles, metadata rendered small above its datum with
  depth-relative disclosure (`OPEN-QUESTIONS.md` C5).
- Live encoding view side by side.
- The prototype keymap (§3.3).
- Grapheme-cluster-correct character-level editing (**C1** — get this right at the start;
  retrofitting it is miserable).
Done when: **the parity test passes.** Type the quick brown fox sentence and put it beside
a text editor. If someone can tell which is which without being told, keep going. This is
the single most important checkpoint in the plan, and it is worth spending real time on
before adding a single further feature.

**Status: done.** The TypeScript target reached this checkpoint and Chris declared the
parity test passed on 2026-09-02. Both demonstrations are on the page — see
`Fold Editor JS/README.md`, and `docs/SECOND-PASS.md` for what each milestone cost.
 
Then, and only then, a second demonstration: **an agent-trace viewer** (§5.6). The parity
test proves this is as good as text at being text; the trace viewer proves it is better at
something text is visibly bad at, for an audience that installs things. Same editor, no new
machinery — a trace is just a deeply nested document with provenance metadata.
 
### 4.4 Stage 2 — Minimum viable product
 
*Patch, staged. Every prior attempt broke here — see `PRIOR-IMPLEMENTATIONS.md`.*
 
**B5 (instancing) is settled — 2026-09-02, and the rule is one sentence: a Patch execution
inherits its view of the value tree from the execution that triggered it.** So yes, an
execution carries an environment pointer distinct from its encoding parent, and it points at
an *overlay* rather than at a scope — which is what lets the "one stack plus Encoding
Parent" closure model survive contact with function calls untouched, because closure decides
*where* a path resolves and the inherited overlay decides *which version of the tree* it
resolves against. Two axes, no collision.

Function application is emergent, not first-class: a caller writes the arguments into place
and moves its focus to the output value, which is itself a Patch that now has cause to
evaluate and reads the arguments through the caller's overlay. Two call sites coexist
because neither ever touched the definition. **Instancing is therefore not a mechanism to
build** — it is what an inherited overlay already does. Evaluation stays lazy and
demand-driven from the view, and an output is cached against the (Patch, overlay) pair it
was computed for. `OPEN-QUESTIONS.md` **B5** carries the resolution and its consequences;
**B17** and **C10** were the two questions it raised, and both are settled — 2026-09-03, and
together, because they wanted one key. **An overlay is a value**, so an instance is that
pair used as a lookup key rather than an object with a cache to dirty, and in the view the
instance belongs to the *model* while the *site* carries continuity through time.
 
**2a — Reference only.** Patch container; virtual cursor; navigation opcodes
(`parent`, `child`, `previous`, `next`, `metadata`, `ID`, `UID`, `info`); auto-evaluation;
Patch results drawn with a drop shadow; circular-reference detection for all three cases.
Copy/paste authors a Patch and nobody sees an instruction. **Fold is now a graph.**

*Done in `Fold Editor JS` as of 2026-09-04, in four slices, and everything above is built.
`ID` and `UID` find a node; a Patch stands for the value it
evaluates to, memoised on the (Patch, overlay) pair; and a Patch met in a document draws as
that value under a shadow — see `index.html#reference`. Two things came out differently
from the list above and both are argued in that tree's `docs/DECISIONS.md`. **Circular
detection is split across two layers on the specification's own instruction**: cases 1 and
3 are the evaluator's, case 2 is the view's, because nothing loops in case 2 except the
drawing. And **the Ouroboros glyph was not written**, because forcing happens on use, so
the self-reference is always consumed by the instruction that demanded it and no value in
this tree can carry one; what a cycle draws is the Problem it raises. `info` waits on B18.
**And copy and paste landed on 2026-09-04**, which is 2a's last sentence and needed no
overlay: a reference is a Patch spelling a path, so ctrl+c remembers which node was
pointed at and ctrl+v seats a Patch spelling the way there. The one thing it could not
borrow from the recorder is that a paste shifts the seats its own path counts — argued in
that tree's `docs/DECISIONS.md`. **Fold is a graph a person can author.** What is next is
2b.*
 
**2b — Recalculation.** Four edit events; the six monitor classes; the
navigation-to-monitor mapping. Without this, editing a referenced value does not update its
references, and the illusion collapses immediately.

*Done in `Fold Editor JS` as of 2026-09-07. The edit events existed from milestone 1 and
were shaped for this; the six classes, **Monitor Key Query** reconstructed from a
commented-out block (B15), the mapping and the recalculation are new. The whole of it shows
up as one deleted line — the session no longer drops every cached reference value on every
keystroke — and `#reference` behaves as it did, for the right reason. Three things came out
differently from the list above and all three are argued in that tree's `docs/DECISIONS.md`.
**Subscribing to Child Replaced is how a monitor *ignores* a replacement**, not how it hears
about one, which is what decodes the dissertation's own event lists. **Two dependencies are
not in the tree** and no monitor can watch them: a result read through another result needs
an explicit dependents graph, and a navigation that *raised* is answered by not caching
refusals at all. And the shadowing monitor needs a **confirmation step** — waking is cheap,
firing is not — because metadata arrives attached to nodes as well as by being edited.
`count()` and `index()` came back as opcodes 18 and 19 to make the monitor table consistent
with the enumeration (B1). What is next is 2c.*
 
**2c — Modification.** `insert`, `remove`, `write`, `append`, `fill`; the truncated-subtree
overlay with its Parents List and Cloning Map; List-as-stack-frame. **Fold is now pure
functional.**

*Done in `Fold Editor JS` as of 2026-09-08, with one deliberate exception. Four of the five
opcodes are built; `fill` still answers with a Problem naming **B8** — whose B5-era framing,
that `fill` might be a by-value calling convention beside B5's by-reference one, Chris
retired the same day: it is shorthand for writing each argument into each Parameter
placeholder in order, and which convention that reads as depends only on what you write
into the slot (§5.4). What is left of B8 is its original list of spellings.
`index.html#derived` is the demonstration and is the pair to `#reference` rather than
another of it: 2a put a second *reading* of one fact on the page, and this puts a second
*version* of it there — three lists, one written down and two derived from it by Patches
that append and remove, with the fact unchanged underneath them. Type into an item and all
three move. Four things came out differently from the list above and all four are argued in
that tree's `docs/DECISIONS.md`. **The Parents List was already written** — a cursor tier is
a parent and an index because `insert` and `remove` are defined that way, so section 4.7's
second structure has been in `PatchCursor` since milestone 2 and `overlay.ts` holds no path.
**Copies are detached and their shared children still point at the document**, which
`List.shallowCopy`'s own comment had guessed the wrong way round: both trees are live at
once, and a document node pointing into an overlay stops bubbling its own edits to its own
root. **An overlay covers everywhere the execution can return to** — found by a stack frame
that ended, restored the cursor into the source, and gave a quietly wrong answer. And
**linearity is enforced rather than assumed**: a write mints a successor that takes the
Cloning Map and marks its predecessor spent, which is B17's "unreachable rather than stale"
made checkable, and it is the answer to the one thing B17 said to watch for when this was
built. Function application needed nothing built for it, exactly as B5 said. What is next
is 2d.*
 
**2d — Demonstration.** Record mode; the edit-propagation rule; the refactoring engine that
merges consecutive removes and drops statements a later write obviates. **Editing is now
programming.**
 
Done when: the JFK-quote example from the dissertation can be authored end to end by
demonstration, without typing an instruction, and re-runs correctly when its source changes.

*Done in `Fold Editor JS`, and with it **Stage 2 is done — declared by Chris on 2026-09-14.**
The Kennedy quote has been authored by keystroke since 2026-09-12 (`index.html#kennedy`, and
`app/kennedy.test.ts`, which presses every key): copy the clause, paste a reading of it, and
rearrange the reading with delete, typing and alt+arrow; edit the clause and the reading
re-runs. The program it records is §8.5's seven statements, differing only in spelling. Three
things came out differently from the list above, and all three are argued in that tree's
`docs/DECISIONS.md`. **Record mode is not a mode**: recording is the default, capture follows
the cursor, and ctrl+s on a reading puts a `sync` in it. **Pushing a reading back to its fact
is `sync`**, so buttons in a document arrived on the way (`#snake`) — and accepting one swaps
the Patch's own instances into the source, so the statements after its `sync` write through
to what it was holding. And **the refactoring engine is three small rules** rather than one
pass: consecutive moves of one element merge, a write folds into the insert that seated its
value, and one keystroke in a reading is one statement. Left open inside Stage 2, and none of
it on Stage 3's path: `fill` (**B8**), `info` (**B18**), `registry`'s contents (**B11**), and
showing a second `sync`'s button. What is next is Stage 3, starting with effects and
computation.*
 
### 4.5 Stage 3 — Full specification
 
Roughly independent tracks; order by what you want to demonstrate next.
 
- **Effects and computation.** `sync`, Side-Effect objects as buttons, the composition rule,
  a permission model (**B12** — it does not exist yet). Native-service objects: logic,
  arithmetic, control flow. Then `OS`: stdio, filesystem tree, executable interface,
  sockets. Hello World is a button.

  *Begun in `Fold Editor JS` on 2026-09-14, at the end that needs no permission model:
  arithmetic, comparison and logic as native services (`src/patch/library.ts`), called from a
  Patch as `+(394 167)` and drawn as their answers. `index.html#invoice` is the page — an
  invoice whose subtotal, delivery charge and total are formulas over readings of the price and
  quantity, and follow them as they are typed. The counter the buttons above want is one
  decision away: whether `write(v)` evaluates a Patch argument, which `write patch` being the
  un-evaluated form suggests it should. **Decided 2026-09-16 (Chris): it does**, so `#counter`
  counts; and ctrl+P turns a List into a Patch, so a formula can be typed.*
- **Types.** `schema` metadata as prototypical instances, identity-vs-equality checking,
  `choose` and Choice Points as sum types, advisory schema-guided editing — advisory,
  per §2.5.
- **Encoding completeness.** Free-space management and the eleven-step in-place
  modification algorithm; Encoding Plans; Continuation; incremental decoding; delayed
  loading. **This is the C++ track's centre of gravity** and where the performance claims
  get measured.

  **Write-through comes back here, and this is the note to find when it does** (Chris,
  2026-09-08). §3.6 settles that recording is the default and that there is no mode where an
  edit inside a reading writes straight to its fact — on the TypeScript target, for a person
  editing, where the transient layers cost nothing that matters. The C++ target inverts every
  term of that argument: editing a fully-consistent encoding **in place** is the thing this
  format is unusually good at, and a write-through mode is what lets a high-speed or
  high-volume caller cut out the layers that exist to make an edit undoable and reviewable —
  the in-memory overlay, and the accumulation of Patch instructions nobody will read. Two
  things to hold on to when it is designed. It is **formal and probably global** — a property
  of how a runtime was configured, declared once, rather than a mode a cursor wanders in and
  out of; the thing §3.6 rejects is a *per-edit* ambiguity about where a write lands, and a
  runtime that has said up front that it writes through has no such ambiguity. And it is a
  different platform for a different caller, so it does not reopen the editor's question:
  the acceptance step is what a *person* is owed, and a batch process is not owed it.
- **Presentation.** The face system; the CSS dialect (name the subset — **D1**); `format`
  handlers.
- **Programming by example.** `case`, `generalization`, the background function search.
  Last, because it is research and everything else is engineering.
### 4.6 Deliberate omissions
 
Not building these, early, is as important as building the rest.
 
- **No file-format converters until Stage 3.** They are how the project becomes a JSON
  library that nobody needs.
- **No performance work in the TypeScript implementation.** It is the UX probe. Let it be
  slow.
- **No schema enforcement before advisory validation feels right.** §2.5.
- **No new base types.** Three slots remain. Spend none of them without a written argument.
- **No opcode renumbering below 18.** The 0–17 assignment is the one thing two prior
  implementations already agree on. Additions go at 18 and up.
---
 
## 5. Why now: machine intelligence as the co-occurring wave
 
Major shifts in end-user media have each ridden a co-occurring technology wave. Text rode
timesharing and the teletype. The GUI rode the bitmapped display. The DOM rode networking.
A fourth medium needs a wave of its own, and being right is not a substitute for having one.
 
In 2017 VR looked like a candidate and was not one — it turned out to be an output medium
with no authoring story, which is exactly the incompleteness §2.2 diagnoses in the GUI.
Large language models are a better-matched wave, because their entire substrate *is* the
encoding of information, which is this project's actual territory.
 
This section is the strategic argument for building now. It is newer than the dissertation
and deliberately falsifiable: §5.7 states what would sink it, and `OPEN-QUESTIONS.md`
section **E** carries the open questions in the same form as everything else.
 
### 5.1 The same argument, one generation later
 
The thesis of §1 is that text was inherited from a machine that no longer exists, and that
nobody ever chose it on merits. There is now a second instance of the same pattern:
 
**Language models emit and consume text because that is what they were trained on. It is an
artifact of a corpus, not a requirement of an architecture.**
 
Same shape of expired constraint — except this one is about fifteen years old rather than
seventy, which makes it enormously more tractable.
 
And the format that won is a poor one. Markdown became the de facto interchange medium of
the most structurally capable systems ever built, and **Markdown's hierarchy is not even
encoded — it is inferred.** `##` opens no scope and nothing closes it; nesting is
reconstructed by a renderer applying heuristics to a flat sequence of lines. Beyond that it
has no reference (so repeated content is repeated), no typed quantities (every number is
characters), no way to annotate a span without inventing syntax, and no schema. Its
structure is a rendering hint, not a data model. This is the qualitative-syntax pathology of
§1 in its purest form, arriving in 2023 rather than 1963.
 
### 5.2 The ecosystem is reinventing these mechanisms right now, in public
 
The dissertation observes that developers endlessly reinvent plaintext formats because no
baseline medium is both succinct and descriptive. That is currently happening at scale:
 
- **Tag soup in prompts.** Every serious agent framework has invented an XML-ish convention
  to demarcate regions of a context window. That is structure reinvented through
  metacharacters, in a medium with no metadata channel.
- **Constrained decoding is schema-guided editing**, applied to a model instead of a person.
  The industry arrived independently at the mechanism of §6.2 of the specification.
- **Prompt injection is the escape-sequence problem.** There is no way to say "this region
  is data, not instruction" in a flat token stream, because there is no out-of-band channel.
  Every mitigation is therefore a sanitization scheme — the escape-sequence pathology of §1,
  arrived at from a new direction.
- **Context repetition is the string-de-duplication problem**, now metered. The measured
  26.1% saving in `SPECIFICATION.md` §7.1 came from exactly this: referencing repeated
  content instead of restating it.
### 5.3 Verbosity is billed at the point of use — but state the claim correctly
 
Tokens are the unit of cost, latency and context budget. This is the first time in the
history of computing that verbosity has a directly metered price where it is incurred.
 
**The honest form of the argument is not "binary is smaller."** Tokenizers are fitted to
text; a binary payload tokenizes badly today, and base64 is worse than the verbose text it
would replace. The claim that survives scrutiny is narrower and still strong: *structure
known out-of-band beats structure respelled inline on every turn.* That is a claim about
schemas and references, not about binariness. Keep it in that form.
 
### 5.4 The corpus problem, solved from an unexpected direction
 
This is the most consequential item in this section.
 
The bootstrap has always been circular: the medium is worth having once there is data in
it, and there is no data in it. The dissertation's answer was a suite of converters
(`SPECIFICATION.md` §6.6) — and that answer does not scale, because somebody has to write
each one, by hand, per format.
 
**Language models are the first tool that makes converting arbitrary information into this
encoding more or less painless.** Not merely syntactic transformation: schema inference,
entity recognition, deciding what is data and what is metadata, attaching provenance,
recovering the structure a format threw away. Conversion work that was a project per format
is now a prompt.
 
That changes the adoption calculus more than any other single fact in these documents.
**A corpus can now exist before ubiquity does.** The chicken-and-egg problem that has
defeated every proposed successor to text is, for the first time, not obviously fatal.
 
The caveat has teeth: conversion becomes probabilistic. Note what the existing design
already does about this — the converter interface asks each converter for a **confidence
assessment** before anything is applied, and ranks them. That interface was designed in 2017
for deterministic parsers and turns out to be exactly the right shape for a probabilistic
one. Round-trip verification (render back to the original format, diff against the input) is
what makes it safe, and it belongs in the converter pipeline from the first version rather
than being retrofitted. See **E4**.
 
### 5.5 The trust boundary, and the case for structure in training
 
Prompt injection remains unsolved because a flat token stream cannot mark a region as data
rather than instruction. This medium has that channel by construction: metadata is
structurally distinct from data at the encoding layer, and unrecognized metadata passes
through intact.
 
**Be clear about what that does and does not buy.** A format does not solve injection. A
model flattens everything to tokens, and attention does not respect a structural boundary
merely because one exists. The boundary has to be *learned*, not merely represented — but it
cannot be learned if it is never represented, and today it is represented nowhere, in no
format, which is why every mitigation is a sanitization scheme.
 
That is the argument for this project having a relationship with **training**, not only with
inference: provenance, trust level, and the data/instruction distinction are properties a
model could plausibly learn to respect if they were structurally present in the medium it
learned from. This is the most speculative claim in these documents. It is stated because it
is the version of the vision that would matter most if it held. See **E5**, **E6**.
 
The near-term, concrete, testable version is **constrained decoding against a schema.**
Because the medium has no textual syntax, generating a valid document means generating a
tree rather than generating characters that must subsequently parse. An entire failure class
disappears: no unterminated structures, no hallucinated escapes, no ambiguity about whether
a quote is a delimiter or content. Schema metadata *is* the grammar. This is buildable
against today's models and is the most falsifiable claim in this section — so build it
early.
 
### 5.6 The wedge: agent traces
 
The adoption argument in these documents needs one correction: gradualism does not work for
a medium whose value is a network effect. The move is to pick a single niche where this
wins standalone, with zero ubiquity, and win it outright. This is the best candidate
available, and it is better than the config-file niche the dissertation gestures at.
 
Consider what an agent execution trace actually is: deeply nested, heterogeneous, carrying
provenance on every node, referencing the same objects repeatedly, mixing data with
computation, wanting metadata channels for source and trust and confidence, needing collapse
and expand at every level — and currently rendered as scrolling text into a bespoke viewer
that every framework has rebuilt separately and badly.
 
That is this format's document, exactly. It is also the origami thesis of §2.3 in its purest
available form: the artifact you most want to open up, at whatever depth your curiosity
reaches, without changing tools. And the audience is developers, who install things — which
is the bootstrap problem that actually needs solving.
 
**Recommendation:** make a trace viewer the Stage 1 demonstration subject alongside the
parity test. The parity test proves the medium is as good as text at being text. The trace
viewer proves it is better at something text is visibly bad at, to an audience that feels
that pain daily. The cut Reflective-User-Interfaces chapter is directly relevant here —
synthesizing an interface from structure is precisely what tool-result rendering needs and
does not have.
 
### 5.7 What would sink this argument
 
Stated plainly, because a strategic argument that cannot fail is not worth making.
 
- **The tokenizer.** Models see BPE tokens fitted to text. Direct model consumption of a
  binary medium is not near-term feasible, and nothing in the implementation plan should
  depend on it changing. **E1.**
- **Cheap parsing undercuts part of the cost case.** A model that reads anything makes
  brittleness much less painful. Drop "parsing is hard" from the pitch; it is the weakest leg
  now. What survives is random access, in-place modification, metadata channels, referential
  structure, and determinism — none of which are about parsing difficulty. **E2.**
- **Markdown's human-auditability is a virtue, not an accident.** It won partly because a
  human is in the loop precisely to read the output. Displacing it requires a viewer
  everywhere — which is the same ubiquity argument this project makes about text, pointed
  the other way. **E3.**
- **Fashion risk.** Chasing this wave could turn a claim about the baseline medium of
  computing into a feature in a crowded, fast-dating category. Do not become an "AI data
  format."
And the structural caution: **waves lift things that are already on the beach.** The web
lifted HTML because HTML existed and was ready. A wave rescues nothing that is unbuilt. That
is an argument about sequencing rather than philosophy, and it points the same way §4 already
does — build the demonstrable thing now.
 
### 5.8 The supply-side reading
 
There is a second sense in which this may be the wave, and it has nothing to do with what
models consume.
 
This project has stalled five times, and `PRIOR-IMPLEMENTATIONS.md` shows every stall at the
same place: the labor of building something ambitious alone. That constraint has changed
materially. The wave may not be "models need this medium" — it may simply be that the medium
is now buildable by one person. On the evidence of the last decade, that is the constraint
that has actually been binding.
 
## 6. Roadmap: rebuilding the stack
 
The stages above produce a medium. This section is what the medium is *for*. It is
deliberately speculative, and everything in it is downstream of Stage 2 working.
 
The through-line: **most of the distinctions in the current computing stack are artifacts
of text, and dissolve when the baseline medium changes.**
 
### 6.1 The browser and the editor are the same program
 
A Fold editor that honors `CSS` metadata renders documents. It also edits them. It also
shows their encoding. These are cursor depths and face selections in one application, not
three applications.
 
What collapses: view-source versus view-page; the DOM as a separate object model from the
document; HTML, CSS and script as three languages instead of three metadata channels on
one structure; the browser's read-only posture. Fold is a binary HTML that is also its own
authoring tool, and HTTP headers — mostly numbers — become Fold structures that save both
parsing and bytes.
 
The intermediate step is real and worth taking: Fold as an alternative to XML/YAML for
config, Fold widgets replacing text fields while flattening to plain strings for
applications that demand them, a Fold extension for existing browsers.
 
### 6.2 Source code without character syntax
 
A language whose grammar is Fold is already an AST. There is no parse step, no lexical
constraint on identifiers, no reserved word, no escape.
 
Concretely:
 
- Identifiers can contain spaces and punctuation, because tokens are length-delimited.
- An identifier can be a **Patch reference to its canonical definition**, so renaming is a
  single edit and the editor does not need to understand the language to do it correctly.
- Version control moves from lines to nodes: fewer merge steps, fewer merge bugs, and a
  change list that is literally a Patch.
- Comments, doc comments and annotations are metadata channels, structurally attached to
  what they describe rather than adjacent to it.
- Copy-paste is a shallow copy until someone writes, so code duplication has a memory cost
  near zero and its provenance is retained.
- Compression is a Patch rewrite: de-duplicated source is still ordinary, readable,
  editable source, and no decompressor exists.
The honest open question the dissertation names: nobody knows what the *good* Fold dialect
of a language looks like. C-like syntax had decades of evolution; Fold has more degrees of
freedom and no accumulated taste. Which parts of a grammar belong in metadata? Should
variable reference and inheritance be Patches at the encoding layer? These have no
principled answers yet and will be settled by usage.
 
### 6.3 The operating system when everything is binary and inspectable
 
Fold encodes on-disk files, wire formats, and — because of Free — runtime heaps. One
encoding for all three collapses a great deal of an OS.
 
- **No serialization boundary.** An application's internal structures are already the
  format it persists and transmits. No adapters, no marshalling layer, no `toString`.
- **The filesystem is a tree in the same medium as the documents in it**, with delayed
  loading, so a file browser with inline editing of file contents is not an integration —
  it is the absence of one.
- **Application transparency.** If applications hold their data in Fold, any running
  application can be opened and inspected live, at whatever depth the user wants, without
  the developer having provided a view. The web already took a weak version of this step
  with browser developer consoles; this is the strong version.
- **Processes as Patches.** An executable loads as an un-evaluated Patch, so its arguments
  have a place to live and invocation is evaluation. Shell, IDE and file manager stop being
  distinct programs.
- **The network as cursor navigation.** With `remote`, a Patch that hops to another host and
  keeps executing *is* a URL — the instructions after the hop name the resource, the result
  is the response, and modification makes it a write. Address and request are one object.
### 6.4 What collapses, summarized
 
| Today | Under Fold |
|---|---|
| Text editor / word processor / IDE | Cursor depth, plus `CSS` and `schema` metadata |
| Web browser / view-source | Metadata display toggle |
| Spreadsheet | Table face over any tree; Patches are formulae |
| File manager / shell / process launcher | `OS` native-service objects in the editor |
| Transfer format / storage format / heap | One encoding |
| Schema language / wire format / debug format | One encoding, varying what is included |
| Parser + renderer per format pair | Converters, ranked by confidence |
| Compression | Patch rewriting, non-obfuscating |
| Undo stack | Patch chain, non-chronological |
| GUI toolkit | Data-driven presentation over metadata |
| Debugger | Editing the heap |
 
### 6.5 Synthetic and reconstructible interfaces
 
Once metadata can attach to anything, presentation agents can attach to subtrees and
provide layout, visualization, and invariant-preserving APIs — micro-interfaces fed *to*
data, rather than data fed to an application. Layered recursively, they approximate a
conventional GUI that can, by construction, be peeled back apart at runtime. That is §2.3's
origami, made concrete.
 
The floor this provides matters as much as the ceiling: an application gets a usable
interface before anyone designs one, and keeps a comprehensive fallback surface for
exceptional use afterward, at nearly no development cost. The cut Reflective-User-Interfaces
chapter — with its working Java `ObjectView` library that synthesizes GUIs from reflection,
its `@Safe` inspection-purity annotation and its constraint annotations — is prior art for
this, written by the same hand, and worth re-reading when Stage 3 reaches it.
 
### 6.6 What success looks like
 
Not adoption of a format. The measure is whether a person with partial computational
fluency gets proportional utility from it — whether the curve in the dissertation's
literacy figure bends. Structure literacy, reference literacy, and abstraction literacy
each paying for themselves at the point they are acquired, in the same medium as ordinary
use, without a separate software stack for developing versus using.
 
Text, GUI and DOM were all additive: each supplemented its predecessors and all three still
coexist. A fourth revolution does not have to displace anything to matter. It has to close
the gap between manipulating individual characters and using a domain-tailored interface,
by putting both on one continuum — bringing text's transparency to interfaces, and
interfaces' capacity for structure and abstraction to text.
 
Those two maneuvers are the same maneuver. It needs two artifacts: a self-describing
universal binary metaformat, and free-form structure editors that make it readable.
 