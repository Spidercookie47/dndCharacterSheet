# Hearthscribe

A D&D 5e character builder that runs in the browser. It builds the character, calculates the numbers, and fills the **official fillable character sheet PDF**.

Everything you can pick (races, classes, spells, items…) is **data in JSON files**, not code. The 5e SRD ships as the first content pack. Homebrew uses exactly the same format, and you add it with a link (for example a file in your GitHub repo). Packs are cached in your browser, so they work offline after the first download.

A **DM mode** reuses the builder for NPCs (ability scores up to 30, extra feats, languages and spells added by hand) and adds a **monster maker** that produces a stat block instead of a character sheet. Monsters can be started from official stat blocks in the content packs. See [DM mode](#dm-mode) and [Monster maker](#monster-maker).

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
    monster.js             DM mode monster maker: Build tabs, reference, stat block preview and PDF
  main.js                  start-up
data/
  srd51/                   the SRD 5.1 as JSON (index.json lists the files, monsters.json included)
  srd52/                   the SRD 5.2 as JSON (optional: the app starts without it)
  homebrew/_template/      a working example pack to copy
assets/                    the fillable sheet PDF
vendor/                    pdf-lib and pdf.js (for filling and previewing the sheet)
tools/
  bundle.py                build the single-file version
  validate_pack.py         check a homebrew pack
```

The scripts are plain (non-module) files that share one global scope. Order matters, and `index.html` lists them in order. `js/ui/monster.js` goes after `events.js` and before `main.js`.

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
- **Monster** (`stat`: a full stat block, see [Adding monsters to a pack](#adding-monsters-to-a-pack)). Monsters are used by the monster maker, not by the character builder.
- **Background** (`chars`: `traits`, `ideals`, `bonds`, `flaws`), **Background Feature**, **Feat**, **Language**.
- Always-prepared spells: `prepared` (`{"class":"Cleric","levels":{"1":["Bless"]}}`). Expanded class lists: `expandedList`. Spells granted by a trait: `featSpells`. Simple magic item bonuses: `effect` (`ac`, `saves`, `wpn`, `spA`, `brac`, `set`).

Run `python3 tools/validate_pack.py my-pack.json` before sharing. `data/homebrew/_template/pack.json` is a complete example: a race, a spellcasting class, a spell and a magic item.

### Adding homebrew in the app

Start → **Sources**: paste a link to a pack or catalog (for example a `raw.githubusercontent.com` link), choose a file, or paste JSON. It is cached in the browser. **Refresh** fetches the newest version, and the checkbox turns a source on or off.

The **Missing content** list on the same screen shows any saved character that uses something that is not available right now, for example because its homebrew source is switched off, and says which source to turn on.

## Saved characters

Characters are kept in the browser, and **Save** downloads a `*.hearth.json` file you can open again from the Start screen. A character file stores your *choices*, not computed numbers, so it keeps working when the rules data changes.

Player and DM characters are kept in separate lists: the Start screen shows the characters of the mode you are in. Opening a character file puts it in the current mode, so that is also how you turn a player character into a DM one.

## Character options

Open **Character options** (top right) to change how a character is built: average hit points, feats and multiclassing. Player characters stop at 20 in each ability score. Characters built in DM mode go up to 30 by default, so there is no option for it. Point buy stays capped at 15; use the standard array or rolled scores for higher numbers.

## DM mode

Use the **Player / DM** switch at the top right. DM mode is the same builder (same tabs, level up, options, sheet and PDF), with two differences:

- **Ability scores go up to 30** by default. There is no option for it, and player characters stay capped at 20.
- **A "+ Add" button** (top right, on every screen except Build → Race and Build → Class) opens a side panel to add an **extra feat, language or spell** to the character. Extras are not locked by level, and spells can come from any class list. They are used everywhere a normal one would be: languages in the Languages list, feats among the features and in the PDF, spells in the Magic tab, on the sheet's spell page and as spell cards. Click an item again to remove it.

Everything else still follows the level rules.

## Monster maker

In DM mode, **Start → Monsters** is the monster collection: new monster, open a monster file, duplicate, delete. Opening a monster changes the top tabs to **Start / Reference / Build / Stat block**, since a monster has no race, class, spell lists or inventory.

**Build** has these sub-tabs:

| Sub-tab | What it holds |
|---|---|
| Basics | name, size, type, tags, alignment, challenge rating. Proficiency bonus and XP follow from the CR. |
| Ability scores | 1 to 30. |
| Defenses | armor class, hit points (worked out from hit dice using the size's die and Constitution, or typed in), speeds (with hover), save proficiencies, skills with proficiency or expertise, damage vulnerabilities, resistances, immunities and condition immunities. Save and skill bonuses are calculated. |
| Senses & languages | darkvision, blindsight, tremorsense, truesight, languages. Passive Perception is calculated. |
| Traits | name and text entries, reorderable. |
| Actions | actions, bonus actions and reactions, with quick buttons for Multiattack, a melee attack and a ranged attack that fill in the to-hit and damage. |
| Legendary | actions per round and the options. The introduction text is added for you. |

Put `*stars*` around words in a description to italicise them, like the printed books do for attack types.

**Stat block** shows the finished block, with **Download stat block (PDF)** and **Save monster file** (a `*.monster.json` you can open again from Start → Monsters). The PDF is built with pdf-lib and needs no template; long blocks continue on more pages. Monsters are kept in the browser, in the same storage as characters but in their own list.

## Monster reference

Monsters are content like everything else: any enabled pack with elements of type `Monster` shows up in the reference, with its source label and the source filter. The SRD 5.1 folder ships a starter set of 20 stat blocks in `monsters.json`. It was typed in by hand, so check a block against the SRD before relying on it at the table.

- **Reference tab → Stat blocks**: filter by source, search, type and CR band. Click one to read it, then **Use as a new monster**, or **Replace** the monster you are editing.
- **Reference tab → Features**: every trait and action of the loaded monsters, grouped by name, with kind chips (traits, actions, bonus actions, reactions, legendary), search and the source filter. Wording that only differs by the monster's own name counts as one feature (Pack Tactics is one entry). Add a feature to your monster as any kind of entry. The monster's name in the text is swapped for yours, and adding the same one twice is refused.
- **In Build**: each list (Traits, Actions, bonus actions, reactions, Legendary) has a **From reference** button that opens a side panel of matching features, with search and the source filter (**Any kind** shows every kind). **Basics → Fill from a stat block** copies part or all of a stat block into the monster you are editing: everything (keeps your name, asks first), size/type/CR, ability scores, defenses, senses and languages, or traits and actions (replace yours or add to yours).

If no monster data is loaded, the reference says so.

### Adding monsters to a pack

Add `Monster` elements to any pack, or put a `monsters.json` next to the other files and list it in that folder's `index.json` (the single-file build picks it up from there). To add monsters to the 5.2 folder, do the same in `data/srd52/`; the source filter then keeps 5.1 and 5.2 apart.

```json
{
  "id": "Monster:Goblin", "type": "Monster", "name": "Goblin",
  "desc": "Small humanoid (goblinoid), neutral evil. Challenge 1/4.",
  "stat": {
    "size": "Small", "type": "humanoid", "tags": "goblinoid", "align": "neutral evil", "cr": "1/4",
    "ab": { "str": 8, "dex": 14, "con": 10, "int": 10, "wis": 8, "cha": 8 },
    "ac": 15, "acNote": "leather armor, shield",
    "hpAuto": true, "hdn": 2,
    "spd": { "walk": 30 },
    "skills": { "Stealth": 2 },
    "sen": { "darkvision": 60 },
    "langs": "Common, Goblin",
    "traits": [ { "n": "Nimble Escape", "d": "The goblin can take the Disengage or Hide action as a bonus action on each of its turns." } ],
    "actions": [ { "n": "Scimitar", "d": "*Melee Weapon Attack:* +4 to hit, reach 5 ft., one target. *Hit:* 5 (1d6 + 2) slashing damage." } ]
  }
}
```

`stat` uses the same fields as a saved monster; anything left out gets a default.

- `cr` is a string: `"0"`, `"1/8"`, `"1/4"`, `"1/2"`, `"1"` … `"30"`. `size` is Tiny to Gargantuan; `align` is free text.
- `hpAuto: true` works hit points out from `hdn` hit dice (the size's die plus Constitution). Use `"hpAuto": false` with `"hp": 120` for a block that does not follow that formula.
- `saves` is `{"wis": true}` for a proficient save. `skills` maps a skill name to `1` (proficient) or `2` (expertise). Bonuses are worked out from these, so do not type them.
- `spd` keys: `walk`, `burrow`, `climb`, `fly`, `swim`; add `"hover": true` for hovering. `sen` keys: `darkvision`, `blindsight`, `tremorsense`, `truesight`.
- `vuln`, `res`, `imm`, `cimm` are plain text (damage vulnerabilities, resistances, immunities, condition immunities).
- `traits`, `actions`, `bonus`, `reactions` and `leg` are lists of `{"n": name, "d": text}`; `legN` is the number of legendary actions per round (default 3).
- Write a monster's own name in its text as the printed books do ("The goblin can…"); the feature library works out the rest.

## The sheet PDF

**Download official sheet** fills the fillable sheet and adds extra pages at the end:

- **Spell cards** for every spell the character has ready: cantrips, prepared spells (or known spells for Bard, Sorcerer, Warlock and Ranger), domain and oath spells, and racial or feature spells. Nine poker-size cards per page. Long spells shrink and then continue on a second card.
- **Item cards** for equipped weapons, attuned or equipped magic items, and potions you press **Equip** on in the Inventory. Weapon cards show the character's own attack bonus and damage.

Both are built in `js/pdf/cards.js`; set `INCLUDE_CANTRIPS = false` at the top of that file to leave cantrips out.

## Licenses

The SRD content is from the System Reference Document 5.1 by Wizards of the Coast LLC, licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). Wizards, D&D and the character sheet are trademarks of Wizards of the Coast; the fillable sheet is theirs and is not part of this project's license. Class and feature summaries, trinkets and the app code are original.
