# Sejuk Ops design package

Design reference for building the Sejuk Ops UI/UX with Claude Code.

```
sejuk-ops-design/
├── DESIGN.md                          ← the spec: principles, tokens, components, layouts, a11y
├── tokens/
│   ├── tokens.css                     ← CSS variables + type classes (drop into globals)
│   ├── tailwind.config.js             ← same tokens as a Tailwind theme
│   └── tokens.json                    ← raw tokens (source of truth)
└── screens/
    ├── admin-operations-overview.png         ← desktop reference (1440px)
    ├── admin-operations-overview-mobile.png  ← same page at 390px
    ├── admin-operations-overview.html        ← open in a browser to inspect exact styles
    ├── technician-today.png                  ← technician mobile reference (390px)
    └── technician-today.html
```

The HTML files are static mockups with sample data. Use them as visual and style references, not as production code.

## Using it with Claude Code

1. Copy this folder into your repo as `design/`.
2. Add this to your project's `CLAUDE.md`:

```md
## UI/UX
- Follow `design/DESIGN.md` for all UI. It is the source of truth for colours, type, radius, components and layout.
- Use the tokens in `design/tokens/` (tokens.css or tailwind.config.js). Never hard-code colours that aren't in them.
- Visual references: `design/screens/*.png`. Match them closely. The HTML next to each PNG shows exact styles.
- Job status colours must come from the status table in DESIGN.md §3.
- Admin = desktop-first (responsive). Technician = mobile-first, 390px, touch targets ≥ 44px.
```

3. Then prompt, for example: *"Build the admin operations overview page from design/screens/admin-operations-overview.png following design/DESIGN.md."*
