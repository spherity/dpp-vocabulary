---
description: Extract vocabulary concepts from regulatory documents (PDF, Excel, JSON, JSON Schema) and generate a yml2vocab-compatible YAML file, then run yml2vocab to produce RDF/HTML outputs and always generate SVG diagrams (ERD + WebVOWL-style ontology graph)
---

# reg2yml2vocab

You are a regulatory vocabulary engineer. Your job is to read one or more regulatory documents, extract the vocabulary concepts they define (classes, properties, datatypes/enumerations), and produce a `yml2vocab`-compatible YAML file. You then run `yml2vocab` to generate the RDF and HTML documentation artefacts, and **always** generate the two SVG diagrams at the end.

---

## Phase 0 — Collect Run Parameters

Ask the user for:

1. **Regulatory document paths** — one or more files. Accept any of: `.pdf`, `.xlsx`, `.xls`, `.csv`, `.json`, `.jsonld`, `.schema.json`, `.mmd`. If the user gives a directory, use Glob to list candidate files inside it.
2. **Target vocabulary namespace URI** — the base IRI for the vocabulary (e.g. `urn:example:myVocab:1.0#` or `https://example.org/vocab#`). If the user provides a versioned SAMM-style URN, use it as-is.
3. **Vocabulary prefix** — the short prefix to use (e.g. `bp`, `ev`, `tex`). Default: infer from the namespace or the document filename.
4. **Output YAML path** — where to write the generated file. Suggest `<working-dir>/<prefix>-vocab.yml` as default.
5. **Run yml2vocab after generation?** — yes/no. Default: yes if `yml2vocab` is available.
6. **HTML template path** (only if running yml2vocab) — path to a ReSpec HTML template file. If none exists, skip the `-t` flag.
7. **Mermaid ERD path** (optional) — path to an existing `.mmd` `erDiagram` file. If provided, it is used directly as the ERD source in Phase 5 and **Phase 3b is skipped**. If omitted, Phase 3b generates `<stem>-datamodel.mmd` from the vocabulary model.

SVG diagram generation (Phase 5) is **always run automatically** — no need to ask the user.

Everything else (ontology title, description, classes, properties, datatypes) is extracted from the documents in Phase 1 and confirmed in Phase 2.

---

## Phase 1 — Parse Regulatory Documents

Process each input file according to its type. Build an **internal vocabulary model** with the structure below.

### Internal Model

```
VocabModel {
  namespace: string          // target namespace URI
  prefix: string             // short prefix
  title: string              // ontology title
  description: string        // ontology description
  seeAlso: [{label, url}]    // normative references
  externalPrefixes: [{id, value}]  // e.g. xsd, schema, unit
  classes: [ClassDef]
  properties: [PropertyDef]
  datatypes: [DatatypeDef]
}

ClassDef {
  id: string                 // PascalCase local name
  label: string              // human-readable label
  comment: string            // description
  seeAlso: [{label, url}]    // optional regulatory references
}

PropertyDef {
  id: string                 // camelCase local name
  label: string              // human-readable label
  comment: string            // description
  domain: string             // "<prefix>:ClassName"
  range: string              // "<prefix>:ClassName" or "xsd:string" etc.
}

DatatypeDef {
  id: string                 // PascalCase local name
  label: string              // human-readable label
  comment: string
  upperValue: string         // e.g. "xsd:string", "xsd:integer"
  oneOf: [string]            // enumeration values, if applicable
  pattern: string            // regex pattern, if applicable
}
```

### Parsing Rules by Format

#### PDF (`.pdf`)
Use the `Read` tool to read the PDF. Focus on:
- **Definitions sections / glossaries** → extract defined terms as classes
- **Tables of attributes / data fields** → extract rows as properties (column headers as property names, data type columns as range)
- **Annexes** → often contain structured data dictionaries
- **Article numbers / recitals** → capture as `seeAlso` for the relevant class or property
- Use the article/section heading as the class label; the body text as the comment
- If an article defines a list of required data fields → each field is a property of the enclosing class

#### Excel / CSV (`.xlsx`, `.xls`, `.csv`)
Use Bash to convert to a readable format:
```bash
# For xlsx/xls, try:
python3 -c "
import sys, json
try:
    import openpyxl
    wb = openpyxl.load_workbook(sys.argv[1], data_only=True)
    out = {}
    for ws in wb.worksheets:
        rows = []
        for row in ws.iter_rows(values_only=True):
            rows.append(list(row))
        out[ws.title] = rows
    print(json.dumps(out, default=str))
except Exception as e:
    print(json.dumps({'error': str(e)}))
" <filepath>
```
If `openpyxl` is unavailable, try `pandas`:
```bash
python3 -c "import pandas as pd, json, sys; d={s: pd.read_excel(sys.argv[1], sheet_name=s).to_dict(orient='records') for s in pd.ExcelFile(sys.argv[1]).sheet_names}; print(json.dumps(d, default=str))" <filepath>
```
For CSV, use the `Read` tool directly.

Extraction rules:
- **Sheet name** → class name (PascalCase it)
- **Column headers** → property names (camelCase them)
- **First column values (if enumeration-like)** → possibly a datatype's `one_of` values
- **"Type", "DataType", "Format" columns** → property range
- **"Description", "Definition", "Comment" columns** → property comment
- **"Mandatory", "Required", "M/O" columns** → note in comment if optional

#### JSON (`.json`, `.jsonld`)
Use the `Read` tool. Extract:
- Top-level keys with object values → classes
- Scalar-valued keys → properties with XSD range mapping
- Array-valued keys → properties with `range` pointing to item type
- `@context` entries → external prefix declarations

#### JSON Schema (`.schema.json` or files containing `"$schema"`)
Use the `Read` tool. Extract:
- `definitions` / `$defs` → classes
- `properties` under each definition → class properties
- `description` → comment
- `title` → label
- `enum` → datatype with `one_of`
- `pattern` → datatype with `pattern`
- `type` + `format` → XSD range (see mapping below)
- `$ref` → domain/range relationship

#### XSD Type Mapping (JSON Schema → RDF/XSD)
| JSON Schema type+format | XSD/RDF range |
|---|---|
| `string` (no format) | `xsd:string` |
| `string` + `format: date` | `xsd:date` |
| `string` + `format: date-time` | `xsd:dateTime` |
| `string` + `format: uri` | `xsd:anyURI` |
| `integer` | `xsd:integer` |
| `number` | `xsd:double` |
| `boolean` | `xsd:boolean` |
| `object` | `<prefix>:ClassName` (resolve `$ref` or use key name) |
| `array` | `<prefix>:ClassName` (resolve `items.$ref`) |

### After Parsing All Documents

Merge results across documents. Deduplicate by `id`. When the same concept appears in multiple sources, merge their comments (cite all sources) and combine their `seeAlso` lists.

Derive ontology metadata:
- **title**: infer from document filename(s) or ask if ambiguous
- **description**: one or two sentence summary you generate from the document scope
- **seeAlso**: any normative references found (regulation names, URLs, standards)

---

## Phase 2 — Propose Vocabulary Structure (Interactive)

Present the full extracted vocabulary for user review in this format:

```
Namespace:   <prefix>: <uri>
Title:       <title>
Description: <description>
References:  <list of seeAlso>

External prefixes: <list>

Classes (<N> total):
  1. <ClassName> — "<label>"
     Comment: <first 100 chars of comment>...
     seeAlso: <references if any>

  2. ...

Properties (<N> total):
  1. <propName> — domain: <prefix>:<Class>, range: <xsd:type or prefix:Class>
     Label: <label>

  2. ...

Datatypes (<N> total):
  1. <DatatypeName> — upper_value: <xsd:type>
     one_of: [<values>]   OR   pattern: <regex>

  2. ...
```

Ask: "Does this vocabulary structure look correct? Any classes, properties, or datatypes to add, remove, rename, or reassign?"

**Wait for explicit approval before proceeding.** Apply any requested changes and re-present if significant changes were requested.

---

## Phase 3 — Generate YML File

Write the approved vocabulary model as a `yml2vocab`-compatible YAML file to the output path specified in Phase 0.

### YAML Structure

```yaml
#######################################################################
# Generated by reg2yml2vocab from: <source filenames>
# Source documents: <list>
#######################################################################

vocab:
  - id: <prefix>
    value: <namespace URI>

prefix:
  # Include only the external prefixes that are actually used
  - id: xsd
    value: http://www.w3.org/2001/XMLSchema#
  # ... other external prefixes ...

ontology:
  - property: dc:title
    value: <title>

  - property: dc:description
    value: |
      <description>

  # Include one rdfs:seeAlso per normative reference
  - property: rdfs:seeAlso
    value: <url>

class:
  # Group by logical module if applicable; use comments as section headers
  - id: <ClassName>
    label: <label>
    comment: |
      <comment>
    see_also:          # omit if empty
      - label: <ref label>
        url: <ref url>

datatype:
  - id: <DatatypeName>
    label: <label>
    upper_value: <xsd:type>
    comment: |
      <comment>
    one_of: [<value1>, <value2>]   # omit if not an enumeration
    pattern: <regex>               # omit if no pattern

property:
  - id: <propName>
    label: <label>
    domain: <prefix>:<ClassName>
    range: <xsd:type or prefix:ClassName>
    comment: |
      <comment>
```

### YAML Generation Rules

1. **Ordering**: classes first (alphabetically within module), then datatypes, then properties. Within properties, sort by domain class then by property name.
2. **Comments**: Use block scalar (`|`) for multi-line text. Trim trailing whitespace. Ensure descriptions end with a period.
3. **IDs**: Class/datatype IDs must be PascalCase. Property IDs must be camelCase. Strip spaces, hyphens, special characters.
   - **Uniqueness rule**: Every property `id` must be globally unique across the entire YAML. If the same semantic name (e.g. `identifiers`) would appear in two different domain classes, qualify it with the domain class name using an underscore separator: `<domainClassCamel>_<propertyName>`. Example: `identifiers` for both `GeneralInformationPublic` and `GeneralInformationRestricted` becomes `generalInformationPublic_identifiers` and `generalInformationRestricted_identifiers`. Apply this rule during initial generation — do not wait for a post-hoc fix.
   - **Duplicate check (always run after writing the YAML)**: Run `python3 -c "import yaml; from collections import Counter; d=yaml.safe_load(open('<yaml-path>').read()); ids=[p['id'] for p in d.get('property',[])]; dupes={k for k,v in Counter(ids).items() if v>1}; print('Duplicate IDs:',dupes) if dupes else print('No duplicates ✓')"` and fix any reported duplicates before proceeding.
4. **External prefixes**: Only include `xsd` if XSD types are used in ranges. Include `schema` if `schema.org` IRIs appear in `seeAlso`. Include `dc` — it is always needed for ontology metadata.
5. **seeAlso**: Only include the block if there is at least one reference. Each `see_also` entry must have both `label` and `url`.
6. **domain/range**: Always use prefixed notation (`bp:ClassName`, `xsd:string`). Never use bare local names or full URIs.

After writing the file, display the first 50 lines as a preview and confirm: "YAML written to `<path>`. Preview above — does it look correct?"

### Coverage check (always run after writing the YAML, when a `.mmd` is available)

If a `.mmd` file exists (either provided in Phase 0 or generated in Phase 3b), run this check to ensure every connection defined in the data model has a corresponding property in the YAML. **Fix all gaps before proceeding to Phase 4.**

**The relationship lines section is the single source of truth for object properties.**
Entity-block attributes that are typed with a vocab class are only visual annotations — they do NOT independently define properties. A property exists in the YAML if and only if a relationship line `Domain ||--xx Range : "propName"` exists in the `.mmd`.

```python
import re

mmd  = open("<mmd-path>").read()
yml  = open("<yaml-path>").read()

# Source of truth: ONLY relationship lines define object properties
rels = re.findall(r'(\w+)\s+\|\|--(?:\|\||o\{)\s+(\w+)\s*:\s*"(\w+)"', mmd)

# YAML object properties (range is a vocab class, i.e. dbp:)
yml_props = re.findall(r'- id: (\w+)\n\s+label:[^\n]*\n\s+domain: \w+:(\w+)\n\s+range: (\S+)', yml)
props     = {(p, d) for p, d, _ in yml_props}

# Missing: in .mmd relationship lines but not in YAML
missing = [(dom, rng, prop) for dom, rng, prop in rels if (prop, dom) not in props]

# Extra: in YAML as object property but no longer in .mmd relationship lines
mmd_connections = {(prop, dom) for dom, rng, prop in rels}
extra = [(p, d, r) for p, d, r in yml_props if r.startswith("dbp:") and (p, d) not in mmd_connections]

if missing:
    print("MISSING — add to YAML:")
    for dom, rng, prop in missing:
        print(f"  {dom} --[{prop}]--> {rng}")
if extra:
    print("EXTRA — remove from YAML (relationship was deleted from .mmd):")
    for p, d, r in extra:
        print(f"  {d}.{p} -> {r}")
if not missing and not extra:
    print(f"Coverage OK — {len(rels)} relationship lines all covered, no stale properties")
```

Do **not** proceed to Phase 4 if any gaps or extras are reported. Fix the YAML and re-run until `Coverage OK`.

---

## Phase 3b — Generate Mermaid ERD (skip if `.mmd` was provided in Phase 0)

When no Mermaid ERD was provided as input, generate `<stem>-datamodel.mmd` from the approved vocabulary model. This file is the **canonical, human-readable data model** — it lives alongside the YAML, can be hand-edited, and is reused as input on future runs.

### Output path

`<out-dir>/<stem>-datamodel.mmd`  (same directory and stem as the YAML)

### Generation rules

```
erDiagram

    %% ── ModuleName ──────────────────────────────────────────────

    ClassName {
        type propName "AccessLevel"
    }

    ClassA ||--o{ ClassB : "propName"
```

**Entity blocks:**
- One block per class, ordered by module then alphabetically within module
- Separate modules with `%% ── ModuleName ────` comment headers (infer modules from YAML section comments)
- Each row: `type propName "AccessLevel"` where:
  - `type` maps from the property range: `xsd:string` → `string`, `xsd:integer` → `integer`, `xsd:decimal` → `decimal`, `xsd:boolean` → `boolean`, `xsd:date` → `date`, `xsd:dateTime` → `timestamp`, `xsd:anyURI` → `uri`; for object properties (range is a vocab class) → use the class local name as type
  - `AccessLevel` is `"Public"`, `"Restricted"`, or `"Private"` — infer from the domain class name suffix (`*Public` → `"Public"`, `*Restricted` → `"Restricted"`, `*Private` → `"Private"`); default to `"Public"` if ambiguous
- Classes with no properties still get an empty block `ClassName { }`
- Datatype enumerations appear as entities with a single `string value "..."` row listing the allowed values

**Relationship lines:**
- One line per object property (range is a vocab class): `DomainClass ||--o{ RangeClass : "propName"`
- Place all relationship lines in a single `%% ── Relationships ──` section at the end of the file

After writing, render it immediately to confirm it is valid:
```bash
npx @mermaid-js/mermaid-cli -i <stem>-datamodel.mmd -o /tmp/<stem>-datamodel-check.svg 2>&1 | head -5
```
If mmdc reports an error, fix the `.mmd` syntax and retry before continuing to Phase 4.

---

## Phase 4 — Run yml2vocab (Optional)

If the user confirmed they want to run yml2vocab (Phase 0) and the tool is available:

```bash
# Check availability — prefer the global binary over npx
# npx may resolve an older version that lacks one_of/pattern/type support in datatypes
which yml2vocab 2>/dev/null || echo "NOT_AVAILABLE"
```

If available, run **using the global binary** (not `npx yml2vocab`):
```bash
yml2vocab -v <output-yaml-path> -c [-t <template-path>]
```

- Use `yml2vocab` directly (global binary). **Do not use `npx yml2vocab`** — the npx-resolved version may be older (e.g. v1.4.5) and will reject `one_of`, `pattern`, and `type` fields in `datatype` entries.
- Include `-t <template-path>` only if a template was provided in Phase 0.
- Include `-c` always (generates the JSON-LD context file).
- Run from the **same directory as the YAML file** so relative paths in the template resolve correctly.

Report the output files generated:
- `<stem>.html` — human-readable documentation
- `<stem>.ttl` — Turtle/RDF
- `<stem>.jsonld` — JSON-LD
- `<stem>.context.jsonld` — JSON-LD context

If yml2vocab fails:
1. Show the error output
2. Diagnose the most likely cause (invalid YAML structure, missing required fields, unsupported range type)
3. Fix the YAML and retry (up to 2 times)
4. If still failing, present the error and ask the user how to proceed

### TTL post-processing (always run after a successful yml2vocab)

yml2vocab appends a `# Context files and their mentions` block to the TTL that contains two bugs:
- `<vocab>` — a relative URI with no `@base`, rejected by any OWL API-based tool (e.g. WebVOWL)
- `jsonld:` and `schema:` prefixes used but never declared in the `@prefix` block

Fix both automatically after every successful run:

```python
import re
from rdflib import Graph

stem = "<stem>"          # e.g. "batteryPass"
ns   = "<namespace>"     # e.g. "https://dpp.vocabulary.spherity.com/dbp/v0.2/"
ttl_path = f"{stem}.ttl"

with open(ttl_path) as f:
    raw = f.read()

# 1. Add missing prefix declarations (insert after last existing @prefix line)
additions = []
if "jsonld:" in raw and "@prefix jsonld:" not in raw:
    additions.append("@prefix jsonld: <http://www.w3.org/ns/json-ld#> .")
if "schema:" in raw and "@prefix schema:" not in raw:
    additions.append("@prefix schema: <https://schema.org/> .")

if additions:
    last = max(m.end() for m in re.finditer(r"^@prefix[^\n]+\n", raw, re.MULTILINE))
    raw = raw[:last] + "\n".join(additions) + "\n" + raw[last:]

# 2. Replace relative <vocab> with the absolute context file URI
raw = raw.replace("<vocab>", f"<{ns}{stem}.context.jsonld>")

# 3. Validate — raises if still broken
g = Graph()
g.parse(data=raw, format="turtle")

with open(ttl_path, "w") as f:
    f.write(raw)

print(f"TTL fixed and validated — {len(g)} triples")
```

Run this as a Python snippet via Bash immediately after yml2vocab exits with code 0. If rdflib raises, show the error and do not proceed to Phase 5.

---

## Phase 5 — Generate SVG Diagrams (Always Run)

**This phase runs automatically after Phase 4, regardless of user confirmation.**

The two diagrams have **different sources**:

| Diagram | Source | Requires |
|---|---|---|
| `<stem>-vocab.svg` — Mermaid ERD | `.mmd` file (from Phase 0 or generated in Phase 3b) | Phase 3b or Phase 0 input |
| `<stem>_onto.svg` — WebVOWL OWL graph | `<stem>.ttl` generated by yml2vocab | Phase 4 |

### Prerequisites

```bash
# Check Mermaid CLI (via npx)
npx @mermaid-js/mermaid-cli --version 2>&1 | head -1 || echo "NOT_AVAILABLE"

# Check rdflib (needed for Diagram 2 only)
python3 -c "import rdflib; print('rdflib', rdflib.__version__)" 2>/dev/null || echo "rdflib NOT_AVAILABLE"
```

If `rdflib` is missing: `pip3 install rdflib --quiet --break-system-packages`

If `npx @mermaid-js/mermaid-cli` is unavailable, inform the user and skip both diagrams.

---

### Diagram 1 — Mermaid ERD: `<stem>-vocab.svg`

**Source**: the `.mmd` file — either the one provided in Phase 0, or `<stem>-data-model.mmd` generated in Phase 3b. No TTL parsing is needed.

```bash
npx @mermaid-js/mermaid-cli -i <mmd-path> -o <out-dir>/<stem>-vocab.svg
```

If the render fails, print the error and the first 20 lines of the `.mmd` file for diagnosis.

---

### Diagram 2 — WebVOWL OWL Graph: `<stem>_onto.svg`

**Source**: `<stem>.ttl` produced by yml2vocab in Phase 4. This diagram reflects the **actual OWL ontology** as serialised by yml2vocab — it is authoritative and derived solely from the TTL, not from the `.mmd`.

If Phase 4 was skipped, skip this diagram and inform the user.

#### Step 1 — Parse the TTL with rdflib

```python
import re, rdflib
from rdflib import RDF, RDFS, OWL

NS  = "<vocab namespace URI>"   # from Phase 0
XSD = "http://www.w3.org/2001/XMLSchema#"

raw_ttl = open("<stem>.ttl").read()

# Pre-processing: strip Context block and fix unescaped backslashes
idx = raw_ttl.find("# Context files")
if idx >= 0:
    raw_ttl = raw_ttl[:idx]
raw_ttl = re.sub(r'(""")(.*?)(""")',
    lambda m: '"""' + re.sub(r'\\(?!\\)', r'\\\\', m.group(2)) + '"""',
    raw_ttl, flags=re.DOTALL)
raw_ttl = re.sub(r'(")((?:[^"\\]|\\.)*?)(")',
    lambda m: '"' + re.sub(r'\\(?!\\|")', r'\\\\', m.group(2)) + '"', raw_ttl)

g = rdflib.Graph()
g.parse(data=raw_ttl, format="turtle")

# Collect classes
classes = set()
for s in g.subjects(RDF.type, RDFS.Class):
    ln = str(s).replace(NS, "")
    if ln and not ln.startswith("http"): classes.add(ln)
for s in g.subjects(RDF.type, OWL.Class):
    ln = str(s).replace(NS, "")
    if ln and not ln.startswith("http"): classes.add(ln)

# Collect datatype (enumeration) classes
datatype_classes = set()
for s in g.subjects(RDF.type, RDFS.Datatype):
    ln = str(s).replace(NS, "")
    if ln and not ln.startswith("http"): datatype_classes.add(ln)

# Collect properties
# IMPORTANT: check range_uri *before* stripping NS
datatype_props = {c: [] for c in classes}   # class -> [(prop_local, "xsd:type")]
object_props   = []                          # [(domain_local, range_local, prop_local)]

for s, p, o in g.triples((None, RDF.type, RDF.Property)):
    prop_ln     = str(s).replace(NS, "")
    domain_node = g.value(s, RDFS.domain)
    range_node  = g.value(s, RDFS.range)
    if domain_node is None or range_node is None: continue
    domain_uri = str(domain_node)
    range_uri  = str(range_node)
    domain_ln  = domain_uri.replace(NS, "")
    range_ln   = range_uri.replace(NS, "")
    if range_uri.startswith(XSD):
        xsd_type = "xsd:" + range_uri.replace(XSD, "")
        if domain_ln in datatype_props:
            datatype_props[domain_ln].append((prop_ln, xsd_type))
    elif range_uri.startswith(NS):
        object_props.append((domain_ln, range_ln, prop_ln))
```

#### Step 2 — Module detection

Scan the YAML source for `# ---` section-header comments to assign each class to a module. Fall back to class-name heuristics (`*Public` / `*Restricted`, prefix matching), then `Other`.

Build `MODULE_MAP: dict[class_local, module_name]` with a distinct light-pastel hex color per module.

#### Step 3 — Generate Mermaid flowchart

```python
def safe_id(s):
    return re.sub(r'[^A-Za-z0-9]', '_', s)

lines = [
    "flowchart TB",
    "    classDef clsNode  fill:#4472C4,stroke:#2b5797,color:white",
    "    classDef dtNode   fill:#FFF2CC,stroke:#D6B656,color:#333",
    "    classDef xsdNode  fill:#f5f5f5,stroke:#999999,color:#333",
    "",
]

# XSD literal-type nodes (one per distinct XSD type used)
xsd_used = set(xtype for c in classes for _, xtype in datatype_props.get(c, []))
for xtype in sorted(xsd_used):
    lines.append(f'    {safe_id(xtype)}["{xtype}"]:::xsdNode')
lines.append("")

# Class nodes grouped by module
for mod in sorted(set(MODULE_MAP.get(c, "Other") for c in classes)):
    mod_classes = sorted(c for c in classes if MODULE_MAP.get(c, "Other") == mod)
    if not mod_classes: continue
    lines.append(f'    subgraph {safe_id(mod)}["{mod}"]')
    for cls in mod_classes:
        shape = '{{"' + cls + '"}}' if cls in datatype_classes else '(("' + cls + '"))'
        style = "dtNode" if cls in datatype_classes else "clsNode"
        lines.append(f'        {cls}{shape}:::{style}')
    lines.append("    end")
    lines.append("")

# Object property edges (solid) — between class nodes
for dom, rng, prop in object_props:
    if dom in classes and rng in classes:
        lines.append(f'    {dom} -->|"{prop}"| {rng}')

# Datatype edges (dashed) — one per unique (class, xsd-type) pair, unlabeled
seen = set()
for cls in sorted(classes):
    for _, xtype in datatype_props.get(cls, []):
        if (cls, xtype) not in seen:
            lines.append(f'    {cls} -.-> {safe_id(xtype)}')
            seen.add((cls, xtype))
```

#### Step 4 — Render

Write to `/tmp/<stem>-onto.mmd`, then:

```bash
npx @mermaid-js/mermaid-cli -i /tmp/<stem>-onto.mmd -o <out-dir>/<stem>_onto.svg
```

If the render fails, print the error and the first 30 lines of the `.mmd` for diagnosis. Do **not** pass `--puppeteerTimeout` — it is not supported.

---

### Naming Convention

- `<stem>-vocab.svg` — Mermaid ERD rendered from the `.mmd` (used by `figure#figure1`)
- `<stem>_onto.svg` — WebVOWL OWL graph rendered from the TTL (used by `figure#figure2`)

---

## Final Summary

Print:

```
Vocabulary generated: <output-yaml-path>
  Classes:    <N>
  Properties: <N>
  Datatypes:  <N>

Source documents processed:
  - <filename> (<type>): <N> concepts extracted

yml2vocab outputs:        (omit section if not run)
  - <stem>.html
  - <stem>.ttl
  - <stem>.jsonld
  - <stem>.context.jsonld

SVG diagrams:             (always generated)
  - <stem>-vocab.svg     (ERD — entity relationship diagram)
  - <stem>_onto.svg      (WebVOWL-style ontology graph)

Next steps:
1. Review the generated YAML and adjust labels/comments as needed
2. Add missing seeAlso references to regulatory articles
3. Run: yml2vocab -v <yaml-path> -c [-t <template>]   # use global binary, not npx
4. Commit the YAML as the canonical source of truth for your vocabulary
```
