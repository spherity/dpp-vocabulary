---
name: reg2yml2vocab
description: Extract vocabulary concepts from regulatory documents (PDF, Excel, JSON, JSON Schema) and generate a yml2vocab-compatible YAML file, then optionally run yml2vocab to produce RDF/HTML outputs
---

# reg2yml2vocab

You are a regulatory vocabulary engineer. Your job is to read one or more regulatory documents, extract the vocabulary concepts they define (classes, properties, datatypes/enumerations), and produce a `yml2vocab`-compatible YAML file. Optionally, you then run `yml2vocab` to generate the RDF and HTML documentation artifacts.

---

## Phase 0 — Collect Run Parameters

Ask the user for all of the following in a single message:

1. **Input directory** — the directory containing the regulatory documents to process. Use Glob with patterns `**/*.pdf`, `**/*.xlsx`, `**/*.xls`, `**/*.csv`, `**/*.json`, `**/*.jsonld`, `**/*.schema.json` to discover all supported files inside it. List the discovered files back to the user and ask them to confirm or exclude any before proceeding.
2. **Output directory** — where to write all generated files (the YAML and, if yml2vocab is run, the RDF/HTML artifacts). Suggest `dbp/v<version>/` relative to the project root as default, following the existing versioned folder structure. Create the directory if it does not exist.
3. **Target vocabulary namespace URI** — the base IRI for the vocabulary (e.g. `urn:example:myVocab:1.0#` or `https://example.org/vocab#`). If the user provides a versioned SAMM-style URN, use it as-is.
4. **Vocabulary prefix** — the short prefix to use (e.g. `bp`, `ev`, `tex`). Default: infer from the namespace or the input directory name.
5. **Run yml2vocab after generation?** — yes/no. Default: yes if `npx yml2vocab` is available.
6. **HTML template path** (only if running yml2vocab) — path to a ReSpec HTML template file (e.g. `dbp/v0.1/dbp-template.html`). If none provided, skip the `-t` flag.

The output YAML filename is derived automatically as `<prefix>-vocab.yml` inside the output directory.

Everything else (ontology title, description, classes, properties, datatypes) is extracted from the documents in Phase 1 and confirmed in Phase 2.

---

## Phase 1 — Parse Regulatory Documents

Process each input file according to its type. Build an **internal vocabulary model** with the structure below.

### Internal Model

```
VocabModel {
  namespace: string               // target namespace URI
  prefix: string                  // short prefix
  title: string                   // ontology title
  description: string             // ontology description
  seeAlso: [{label, url}]         // normative references
  externalPrefixes: [{id, value}] // e.g. xsd, schema, unit
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
# For xlsx/xls, try openpyxl first:
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

# Fallback: pandas
python3 -c "
import pandas as pd, json, sys
d = {s: pd.read_excel(sys.argv[1], sheet_name=s).to_dict(orient='records')
     for s in pd.ExcelFile(sys.argv[1]).sheet_names}
print(json.dumps(d, default=str))
" <filepath>
```
For CSV, use the `Read` tool directly.

Extraction rules:
- **Sheet name** → class name (PascalCase it)
- **Column headers** → property names (camelCase them)
- **"Type", "DataType", "Format" columns** → property range
- **"Description", "Definition", "Comment" columns** → property comment
- **"Mandatory", "Required", "M/O" columns** → note in comment whether optional
- **First-column enumeration-like values** → possibly a datatype's `one_of` list

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
| JSON Schema type + format | XSD/RDF range |
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

Present the full extracted vocabulary for user review:

```
Namespace:   <prefix>: <uri>
Title:       <title>
Description: <description>
References:  <seeAlso list>

External prefixes: <list>

Classes (<N> total):
  1. <ClassName> — "<label>"
     Comment: <first 100 chars>...
     seeAlso: <refs if any>

Properties (<N> total):
  1. <propName> — domain: <prefix>:<Class>, range: <type>
     Label: <label>

Datatypes (<N> total):
  1. <DatatypeName> — upper_value: <xsd:type>
     one_of: [<values>]   OR   pattern: <regex>
```

Ask: "Does this vocabulary structure look correct? Any classes, properties, or datatypes to add, remove, rename, or reassign?"

**Wait for explicit approval before proceeding.** Apply any requested changes and re-present if significant changes were made.

---

## Phase 3 — Generate YML File

Write the approved vocabulary model as a `yml2vocab`-compatible YAML file.

### YAML Structure

```yaml
#######################################################################
# Generated by reg2yml2vocab from: <source filenames>
# See the NOTICE file(s) distributed with this work for additional
# information regarding copyright ownership.
#
# This work is made available under the terms of the
# Creative Commons Attribution 4.0 International (CC BY-NC 4.0) license,
# which is available at
# https://creativecommons.org/licenses/by-nc/4.0/.
#
# SPDX-License-Identifier: CC-BY-NC-4.0
#######################################################################

vocab:
  - id: <prefix>
    value: <namespace URI>

prefix:
  # Include only external prefixes actually used in ranges or seeAlso
  - id: xsd
    value: http://www.w3.org/2001/XMLSchema#

ontology:
  - property: dc:title
    value: <title>

  - property: dc:description
    value: |
      <description>

  - property: rdfs:seeAlso
    value: <url>       # one entry per normative reference

class:
  - id: <ClassName>
    label: <label>
    comment: |
      <comment>
    see_also:          # omit block entirely if empty
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

1. **Ordering**: classes alphabetically (group by module with `#` section comments if ≥3 logical groups), then datatypes, then properties sorted by domain then name.
2. **IDs**: Class/datatype IDs → PascalCase. Property IDs → camelCase. Strip spaces, hyphens, special characters.
3. **Text fields**: Use block scalar (`|`) for multi-line text. Trim trailing whitespace. Ensure descriptions end with a period.
4. **External prefixes**: Always include `xsd` if any XSD ranges are used. Include `schema` if `schema.org` URIs appear. `dc` is implicit in yml2vocab — do not re-declare it in `prefix`.
5. **seeAlso**: Omit the block entirely if empty. Each entry must have both `label` and `url`.
6. **domain/range**: Always use prefixed notation (`bp:ClassName`, `xsd:string`). Never bare local names or full URIs.
7. **Namespace constraint**: yml2vocab supports only a **single vocabulary namespace** — all classes, properties, and datatypes must belong to the one `vocab` entry. External types in `range` use declared `prefix` entries.

After writing the file, display the first 60 lines as a preview and confirm: "YAML written to `<path>`. Does the preview look correct?"

---

## Phase 4 — Run yml2vocab (Optional)

If the user confirmed they want to run yml2vocab (Phase 0):

```bash
# Check availability
npx yml2vocab --version 2>/dev/null || echo "NOT_AVAILABLE"
```

If available, run using the same pattern as this project:
```bash
npx yml2vocab -v <output-yaml-path> -c [-t <template-path>]
```

- `-c` — always include (generates JSON-LD context file)
- `-t <template-path>` — only if a template was provided in Phase 0

**Output files generated** (same stem as the YAML, in the same directory):
- `<stem>.html` — human-readable ReSpec documentation
- `<stem>.ttl` — Turtle/RDF serialization
- `<stem>.jsonld` — JSON-LD serialization
- `<stem>.context.jsonld` — JSON-LD context

If yml2vocab fails:
1. Show the error output
2. Diagnose the likely cause (invalid YAML structure, unsupported range type, missing required field)
3. Fix the YAML and retry (up to 2 times)
4. If still failing, present the error and ask the user how to proceed

---

## Final Summary

```
Vocabulary generated: <output-yaml-path>
  Classes:    <N>
  Properties: <N>
  Datatypes:  <N>

Source documents processed:
  - <filename> (<format>): <N> concepts extracted

yml2vocab outputs:         (omit section if not run)
  - <stem>.html
  - <stem>.ttl
  - <stem>.jsonld
  - <stem>.context.jsonld

Next steps:
1. Review the YAML and refine labels/comments as needed
2. Add missing seeAlso references to regulatory articles
3. Run: npx yml2vocab -v <yaml-path> -c -t <template-path>
4. Commit the YAML as the canonical source of truth for this vocabulary version
```
