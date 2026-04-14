# DPP Vocabularies

Vocabulary source files and published outputs for the Battery Pass Digital Product Passport (DPP). The YAML file is the single source of truth — all other files are generated from it.

---

## Structure

```
vocabularies/
├── resources/dbp/v0.2/         ← Edit these
│   ├── batteryPass.yml         ← Vocabulary definition (yml2vocab format)
│   ├── dbp-template.html       ← ReSpec HTML template
│   ├── batteryPass.ttl         ← Generated: Turtle/RDF
│   ├── batteryPass.jsonld      ← Generated: JSON-LD
│   ├── batteryPass.context.jsonld  ← Generated: JSON-LD context
│   ├── batteryPass.html        ← Generated: ReSpec documentation
│   ├── batterypass-vocab.svg   ← Generated: ERD class diagram
│   └── batterypass_onto.svg    ← Generated: ontology graph
│
├── public/dbp/v0.2/            ← Synced from resources/ by pnpm build (served via Pages)
└── package.json
```

---

## Prerequisites

| Tool | Install | Purpose |
|---|---|---|
| `yml2vocab` ≥ 1.8 | `npm install -g yml2vocab` | Generates TTL, JSON-LD, HTML from YAML |
| Python 3 + `rdflib` | `pip3 install rdflib` | Diagram generation |
| Graphviz | `brew install graphviz` | Renders DOT → SVG |
| pnpm | `npm install -g pnpm` | Package manager / build script |

> **Important:** Use the globally installed `yml2vocab` binary directly — do not use `npx yml2vocab`, which may resolve an older version (< 1.8) that does not support `one_of`, `pattern`, or `type` fields in `datatype` entries.

---

## Editing the Vocabulary

All changes start in `resources/dbp/v0.2/batteryPass.yml`. The YAML follows the [yml2vocab](https://w3c.github.io/yml2vocab/) format with four top-level sections:

```yaml
vocab:    # namespace URI and prefix
prefix:   # external prefix declarations (xsd, schema, unit, …)
ontology: # dc:title, dc:description, rdfs:seeAlso
class:    # rdfs:Class definitions
datatype: # rdfs:Datatype definitions (enumerations, patterns)
property: # rdf:Property definitions (domain, range, label, comment)
```

### Conventions

- **Class IDs** — PascalCase (e.g. `BatteryChemistryEntity`)
- **Property IDs** — camelCase (e.g. `batteryCarbonFootprint`)
- **Datatype IDs** — PascalCase with `Datatype` suffix (e.g. `BatteryStatusDatatype`)
- **Module grouping** — use `# --- ModuleName ---` comments to group related classes; the diagram generator uses these as cluster labels
- **seeAlso** — always provide both `label` and `url`; omit the block entirely if empty

### Vocabulary modules

| Module | Description |
|---|---|
| CarbonFootprint | Carbon footprint per lifecycle stage (kg CO₂e/kWh) |
| Circularity | Dismantling, recycled content, spare parts, end-of-life |
| GeneralProductInformation | Product ID, manufacturer, battery category, manufacturing details |
| DPP Metadata | Static metadata (schema version, granularity) and dynamic attributes (status, last updated) |
| Labeling | Declaration of conformity, test reports, required labels |
| MaterialComposition | Battery chemistry, cathode/anode/electrolyte materials, hazardous substances |
| PerformanceAndDurability | Capacity, power, voltage, state of health, internal resistance |
| SupplyChainDueDiligence | Responsible sourcing reports, third-party assurances |

---

## Regenerating Outputs

After editing `batteryPass.yml`, regenerate all outputs and sync to `public/`:

```bash
cd resources/dbp/v0.2

# 1. Turtle, JSON-LD, HTML, context
yml2vocab -v batteryPass.yml -c -t dbp-template.html

# 2. SVG diagrams (requires Python 3 + rdflib + Graphviz)
python3 /path/to/gen_diagrams.py
dot -Tsvg /tmp/erd.dot  -o batterypass-vocab.svg
dot -Tsvg /tmp/onto.dot -o batterypass_onto.svg

# 3. Sync to public/
cd ../..
pnpm build
```

The `/reg2yml2vocab` Claude Code skill automates all of the above including diagram generation.

---

## Build Script

`pnpm build` runs `rsync` to sync `resources/dbp/` into `public/dbp/`, excluding source-only files:

```bash
pnpm build   # rsync resources/dbp/ → public/dbp/ (excludes *.yml and dbp-template.html)
```

To preview the published site locally:

```bash
pnpm webserver   # serves public/ at http://localhost:3000
```

---

## Deployment

Merging to `main` triggers the [deploy-pages](../.github/workflows/deploy-pages.yml) GitHub Actions workflow:

1. `pnpm install --frozen-lockfile`
2. `pnpm build` — syncs resources to public
3. Uploads `vocabularies/public/` as a GitHub Pages artifact
4. Deploys to `https://dpp.vocabulary.spherity.dev`

GitHub Pages must be enabled in repository settings: Settings → Pages → Source: **GitHub Actions**.

---

## Validation

```bash
pnpm validate:jsonld        # validates credentials in docs/contexts/ against JSON-LD contexts
pnpm validate:vocab-links   # checks cross-references in the vocabulary
```

---

## Namespace

```
https://dpp.vocabulary.spherity.dev/dbp/v0.2#
Prefix: bp:
```
