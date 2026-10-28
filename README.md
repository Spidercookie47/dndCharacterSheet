# Hearthscribe

A D&D 5e character builder that runs in the browser. It builds the character, calculates the numbers, and fills the **official fillable character sheet PDF**.

Everything you can pick (races, classes, spells, items…) is **data in JSON files**, not code. The 5e SRD ships as the first content pack. Homebrew uses exactly the same format, and you add it with a link (for example a file in your GitHub repo). Packs are cached in your browser, so they work offline after the first download.

## Run it

| How | Steps |
|---|---|
| **From the folder** (recommended) | Serve the folder over http, e.g. `python3 -m http.server 8000` and open `http://localhost:8000`. Or push it to GitHub Pages. |
| **One file** | `python3 tools/bundle.py` writes `dist/hearthscribe.html`, with everything inlined. Open it from disk or share it as a single file. |

Opening `index.html` directly from disk (`file://`) does not work, because browsers block loading the JSON files that way. Use one of the two options above.

The fillable sheet PDF is **not** included by default in a public repo: put it at `assets/5E_CharacterSheet_Fillable.pdf` (it is free from Wizards of the Coast, and is printable for personal use).

## Folder layout

```
index.html                 page shell: loads the files below in order
css/
  tokens.css               colors (dark, light follows the system)
  layout.css               top bar, sub bar, two columns, status bar
  components.css           rows, cards, forms, tables, side panels, the sheet
js/
  core/                    the rules, no screen code
    constants.js           ability names, skills, coin values
    util.js                small helpers ($, esc, mod, file download)
    registry.js            holds all loaded elements and the tables built from them
    state.js               the character in progress, the saved list, persistence
    engine.js              resolve() follows grants/choices, calc() computes AC, HP, saves, skills…
    leveling.js            levels, hit points, multiclass requirements, proficiencies text
    inventory.js           armor class from worn armor, buying with coins
    casting.js             spell slots (incl. multiclass), prepared/known spells
    resources.js           Rage, Ki, slots… and what a short/long rest restores
  data/
    cache.js               IndexedDB cache for downloaded packs
    loader.js              reads the SRD and packs, validates, merges, toggles sources
  pdf/
    fields.js              maps character data to the official sheet's form fields
    export.js              builds the data, downloads and previews the PDF
    cards.js               spell and item cards, added as extra pages after the sheet
  ui/                      one file per screen
    shell.js               top/sub/status bars and the draw cycle
    events.js              every click, key press and file choice, as named actions
    start.js sources.js build.js asi.js magic.js equipment.js manage.js sheet.js drawers.js rich.js …
  main.js                  start-up
data/
  srd/                     the SRD 5.1 as JSON (see below)
  homebrew/_template/      a working example pack to copy
assets/                    the fillable sheet PDF
vendor/                    pdf-lib and pdf.js (for filling and previewing the sheet)
tools/
  bundle.py                build the single-file version
  validate_pack.py         check a homebrew pack
```

The scripts are plain (non-module) files that share one global scope. Order matters, and `index.html` lists them in order.

## Content packs

A **pack** is one JSON file:

```json
{
  "format": "hearthscribe-pack", "version": 1,
  "source": { "id": "my-homebrew", "name": "My Homebrew", "short": "Homebrew" },
  "elements": [ ... ],
  "info": { "Race:Stoneborn": "STONEBORN\nLong text shown in the side panel..." },
  "tables": { "trinkets": ["..."] }
}
```

- **elements** are the things you can pick. Each has `id` (`"Type:Name"`), `type`, `name`, `desc` and usually `rules`.
- **info** (optional) is longer text for the side panel, keyed by element id. Plain text uses ALL CAPS lines as headings, `Label.Text` for bold labels, and an HTML line starting with `<div class="tw">` for a table. Text that starts with `<` is shown as HTML.
- **tables** (optional): `xp` (XP per level), `trinkets`, `startCategories`.
- A pack can also be an **index** that lists several files (`{ "files": ["races.json", ...] }`, the SRD does this), or a **catalog** that lists packs (`{ "packs": [ { "name": "...", "url": "..." } ] }`).

Later packs replace earlier elements that have the same id, so homebrew can override SRD content.

### Rules vocabulary (`rules` list on an element)

| Rule | Meaning |
|---|---|
| `{"stat": {"con": 2, "speed": 25}}` | +2 Constitution, base speed 25. Other keys: `hpl` (HP per level), `acArm` (AC while armored). |
| `{"grant": "Class Feature:Rage"}` | gives another element (its own rules run too). `skill:Stealth` / `save:dex` grant a proficiency. |
| `{"select": {"name": "Subrace", "type": "Sub Race", "supports": "Race:Elf"}}` | the player chooses `n` (default 1) elements of that `type`. Other filters: `from` (list of skill names), `ids`, `cls`, `spl`+`lvl` (spells of a class list). |
| `{"asi": 1, "level": 4}` | an ability score improvement / feat slot |
| `{"expertise": 2, "level": 3}` | choose two proficient skills to double |
| `{"pf": ["w:Longswords", "t:Thieves' tools"]}` | proficiencies (`a:` armor, `w:` weapons, `t:` tools) |
| `"level": N` on any rule | only from that class level |
| `{"resource": {"id": "tp", "name": "Tinker points", "rest": "L", "min": 1, "max": [{"class": "Tinkerer"}, {"mod": "int"}], "note": "gadgets"}}` | a limited-use resource, shown on the Sheet tab with Use / Restore and covered by the Short rest / Long rest buttons. `rest` is `"S"` or `"L"` (default `"L"`), `min` is a floor, `note` is small text. `max` is a number, `"unlimited"`, or a part or a list of parts that are added together (see below). |
| `{"acFormula": {"base": 10, "add": ["dex", "con"], "noShield": true}}` | AC while wearing no armor. The highest formula wins. `noShield` turns it off while a shield is equipped. |
| `{"speedBonus": {"max": 10, "noHeavy": true}}` | extra speed. `max` takes the same parts as `resource`. `noHeavy` turns it off in heavy armor, `unarmored` turns it off in any armor or with a shield. |
| `{"halfProf": {"abilities": "all", "round": "down"}}` | a half-proficiency bonus on checks you are not proficient in, including initiative when Dexterity is covered. `abilities` is `"all"` or a list such as `["str", "dex", "con"]`; `round` is `"up"` or `"down"`. |
| `{"saveBonus": {"mod": "cha", "min": 1}}` | a bonus to all saving throws (`n` adds a flat number instead). |

**Parts for `max`:** `{"n": 3}` (a number), `{"class": "Tinkerer"}` (your level in that class), `{"class": "Tinkerer", "table": [20 numbers]}` (a lookup by class level), `{"mod": "int"}` (an ability modifier) and `{"pb": true}` (proficiency bonus). Any part can take `"mult"` and `"div"` (rounded down). A list adds its parts, so `[{"class": "Tinkerer"}, {"mod": "int"}]` is level plus Intelligence modifier.

These rules work on any element, usually a Class Feature. Grant the feature from a class with `"level": N` and the bonus starts at that class level. `data/homebrew/test-pack.json` is a larger example that uses every one of them.

### Element types and their extra fields

- **Race / Sub Race** (`supports` = the race id), **Racial Trait**.
- **Class**: `hd` (hit die), `ap` / `mp` (proficiencies, all / when multiclassing), `prereq` (`["str","dex"]` any of, `["&","dex","wis"]` all of), `casting` (`ability`, `mode` = `prep`/`book`/`known`, `half`, `rows` = 20 × `[cantrips, slots 1–9]`, `known`), `start` (starting equipment).
- **Class Feature**, **Subclass** (`supports` = the class id; for a subclass chosen at level N, add the `select` to the class with `"level": N`), **Fighting Style** (`cls` letters).
- **Spell**: `lvl`, `school`, `comp` (`"V,S,M"`), `mat`, `cast`, `range`, `dur`, `ritual`, `lists` (class names).
- **Armor** (`ac`, `kind` Light/Medium/Heavy/Shield, `smin`, `sd`), **Weapon** (`cat`, damage in `desc` as `Damage 1d8 slashing.`), **Gear**, **Magic** (`rar`, `att`, `effect`). Shop fields: `cg` (category), `cp` (price in copper), `wt`.
- **Background** (`chars`: `traits`, `ideals`, `bonds`, `flaws`), **Background Feature**, **Feat**, **Language**.
- Always-prepared spells: `prepared` (`{"class":"Cleric","levels":{"1":["Bless"]}}`). Expanded class lists: `expandedList`. Spells granted by a trait: `featSpells`. Simple magic item bonuses: `effect` (`ac`, `saves`, `wpn`, `spA`, `brac`, `set`).

Run `python3 tools/validate_pack.py my-pack.json` before sharing. `data/homebrew/_template/pack.json` is a complete example: a race, a spellcasting class, a spell and a magic item.

### Adding homebrew in the app

Start → **Sources**: paste a link to a pack or catalog (for example a `raw.githubusercontent.com` link), choose a file, or paste JSON. It is cached in the browser. **Refresh** fetches the newest version, and the checkbox turns a source on or off.

The **Missing content** list on the same screen shows any saved character that uses something that is not available right now, for example because its homebrew source is switched off, and says which source to turn on.

## Saved characters

Characters are kept in the browser, and **Save** downloads a `*.hearth.json` file you can open again from the Start screen. A character file stores your *choices*, not computed numbers, so it keeps working when the rules data changes.

## Character options

Open **Character options** (top right) to change how a character is built: average hit points, feats, multiclassing, and **Ability scores above 20**, which lets scores go up to 30 for NPCs and monsters. Point buy stays capped at 15; use the standard array or rolled scores for higher numbers.

## The sheet PDF

**Download official sheet** fills the fillable sheet and adds extra pages at the end:

- **Spell cards** for every spell the character has ready: cantrips, prepared spells (or known spells for Bard, Sorcerer, Warlock and Ranger), domain and oath spells, and racial or feature spells. Nine poker-size cards per page. Long spells shrink and then continue on a second card.
- **Item cards** for equipped weapons, attuned or equipped magic items, and potions you press **Equip** on in the Inventory. Weapon cards show the character's own attack bonus and damage.

Both are built in `js/pdf/cards.js`; set `INCLUDE_CANTRIPS = false` at the top of that file to leave cantrips out.

## Licenses

The SRD content is from the System Reference Document 5.1 by Wizards of the Coast LLC, licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). Wizards, D&D and the character sheet are trademarks of Wizards of the Coast; the fillable sheet is theirs and is not part of this project's license. Class and feature summaries, trinkets and the app code are original.
