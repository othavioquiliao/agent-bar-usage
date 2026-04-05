# Phase 14: Quality Gate & Production Hardening - Research

**Researched:** 2026-04-05
**Domain:** GNOME Shell 46 dual-stylesheet mechanism, CSS theme awareness, St CSS limitations
**Confidence:** HIGH

## Summary

GNOME Shell 46 (Ubuntu 24.04) ships a built-in dual-stylesheet mechanism for extensions via `extensionSystem.js`. When an extension provides `stylesheet-dark.css` and/or `stylesheet-light.css`, the shell automatically selects the appropriate file based on the system color-scheme GSettings value. The current extension manually loads `stylesheet.css` in its `enable()` method, which conflicts with and doubles the built-in loading -- this must be removed when adopting the dual-stylesheet pattern.

The existing One Dark palette colors (`#e5c07b` yellow, `#98c379` green, `#61afef` blue) all fail WCAG AA contrast on white backgrounds (ratios 1.73:1, 2.02:1, 2.36:1 respectively). Darkened variants that preserve hue identity while passing 4.5:1 contrast have been computed using HSL lightness reduction: `#996e1e` (yellow), `#567f39` (green), `#1579cb` (blue), `#d63e4a` (red).

St CSS supports a limited subset of web CSS: no `var()`, no `calc()`, no `@media` queries, no custom properties. This means the only way to provide dark/light styling is via separate stylesheet files -- exactly the dual-stylesheet mechanism GNOME Shell provides.

**Primary recommendation:** Ship three files: `stylesheet-dark.css` (renamed from current), `stylesheet-light.css` (new), and `stylesheet.css` (copy of dark, for fallback). Remove the manual `_loadStylesheet()`/`_unloadStylesheet()` methods from `extension.js` since GNOME Shell handles this automatically.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-15:** Use GNOME 46's built-in dual-stylesheet mechanism -- zero JavaScript changes required (beyond removing the now-unnecessary manual loading code)
- **D-16:** Rename current `stylesheet.css` to `stylesheet-dark.css`; create new `stylesheet-light.css` with adaptive contrast, same BEM class structure
- **D-17:** Provider brand colors in light mode use slightly darkened variants for better contrast; yellow `#e5c07b` has ~2.1:1 against white -- darken by ~15% lightness
- **D-18:** Keep `stylesheet.css` as copy of `stylesheet-dark.css` for fallback on pre-46 shells

### Claude's Discretion
- Exact light theme color palette values (as long as contrast ratios pass WCAG AA for text)
- Whether to add `[Unit] Documentation=` directive to systemd service
- Whether `as unknown as Partial<Settings>` fix needs a clarifying comment
- Exact `TimeoutStartSec` value (30s recommended, 15-45s acceptable)

### Deferred Ideas (OUT OF SCOPE)
- WatchdogSec (requires Type=notify + sd_notify)
- EnvironmentFile (no user-configurable env vars yet)
- Deep freeze utility (factory pattern + Readonly<> is sufficient)
- CSS custom properties (St does not support `var()`)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| QUAL-01 | Enable Biome strict rules (noExplicitAny, noNonNullAssertion, useNodejsImportProtocol) | Not in scope of this focused research |
| QUAL-02 | Create .editorconfig | Not in scope of this focused research |
| HARD-01 | systemd service hardening | Not in scope of this focused research |
| HARD-02 | Object.freeze on config defaults | Not in scope of this focused research |
| HARD-03 | CSS theme awareness -- dark/light via GSettings color-scheme | Full research below: dual-stylesheet mechanism, color palette, St CSS limitations |
| HARD-04 | Snapshot cache schema versioning | Not in scope of this focused research |
</phase_requirements>

## GNOME Shell 46 Dual-Stylesheet Mechanism

### How It Works (VERIFIED)

The `extensionSystem.js` module in GNOME Shell 46 handles extension stylesheet loading automatically. The code path is: [VERIFIED: GNOME Shell source at `gitlab.gnome.org/GNOME/gnome-shell/-/raw/46.0/js/ui/extensionSystem.js`]

#### 1. Automatic Loading at Enable Time

When an extension is enabled, `_callExtensionEnable()` calls `_loadExtensionStylesheet()` **before** calling `extension.stateObj.enable()`. This means the shell loads the stylesheet before the extension's own `enable()` runs.

#### 2. Stylesheet Resolution Priority

```javascript
_loadExtensionStylesheet(extension) {
    const variant = Main.getStyleVariant();
    const stylesheetNames = [
        `${global.sessionMode}-${variant}.css`,    // e.g. "user-dark.css"
        `stylesheet-${variant}.css`,                 // e.g. "stylesheet-dark.css"
        `${global.sessionMode}.css`,                 // e.g. "user.css"
        'stylesheet.css',                            // fallback
    ];
    // Tries each in order; stops at first file found
}
```

The loader tries files in priority order. For normal user sessions (`global.sessionMode === 'user'`), the practical resolution is:

1. `user-dark.css` or `user-light.css` (session-mode + variant)
2. **`stylesheet-dark.css`** or **`stylesheet-light.css`** (variant-specific -- this is what we use)
3. `user.css` (session-mode fallback)
4. `stylesheet.css` (universal fallback)

It stops at the **first file found**. If `stylesheet-dark.css` exists, it will NOT also load `stylesheet.css`. [VERIFIED: source code shows `break` after successful load]

#### 3. Variant Resolution via `Main.getStyleVariant()`

```javascript
export function getStyleVariant() {
    const {colorScheme} = St.Settings.get();
    switch (sessionMode.colorScheme) {
    case 'force-dark':    return 'dark';
    case 'force-light':   return 'light';
    case 'prefer-dark':
        return colorScheme === St.SystemColorScheme.PREFER_LIGHT ? 'light' : 'dark';
    case 'prefer-light':
        return colorScheme === St.SystemColorScheme.PREFER_DARK ? 'dark' : 'light';
    default:              return '';
    }
}
```

On Ubuntu 24.04 with standard GNOME Shell (not Classic), `sessionMode.colorScheme` is `'prefer-dark'`, which means:
- If user sets `org.gnome.desktop.interface color-scheme` to `'prefer-light'`, variant = `'light'`
- Otherwise (default or `'prefer-dark'`), variant = `'dark'`

[VERIFIED: GNOME Shell 46 source at `main.js`]

#### 4. Automatic Theme Swap on Color-Scheme Change

```javascript
// In ExtensionManager constructor:
St.Settings.get().connect('notify::color-scheme',
    () => this._reloadExtensionStylesheets());

_reloadExtensionStylesheets() {
    for (const ext of this._extensions.values()) {
        if (!ext.stylesheet) continue;
        const path = ext.stylesheet.get_path();
        // CRITICAL: Only swaps if current path ends with variant suffix
        if (!path.endsWith('-dark.css') && !path.endsWith('-light.css'))
            continue;
        this._unloadExtensionStylesheet(ext);
        this._loadExtensionStylesheet(ext);
    }
}
```

**Critical behavior:** The reload ONLY happens for extensions whose currently-loaded stylesheet path ends with `-dark.css` or `-light.css`. If the fallback `stylesheet.css` was loaded (because no variant file existed), theme changes will NOT trigger a reload. This is why providing both variant files is essential. [VERIFIED: source code]

### File Naming Convention (VERIFIED)

| File | When Loaded | Required? |
|------|-------------|-----------|
| `stylesheet-dark.css` | System color-scheme is dark | Recommended |
| `stylesheet-light.css` | System color-scheme is light | Recommended |
| `stylesheet.css` | Fallback when variant file is missing OR on pre-46 shells | Recommended for backwards compatibility |

The `gnome-extensions pack` command automatically includes `stylesheet.css`, `stylesheet-dark.css`, and `stylesheet-light.css` if found in the extension directory. [VERIFIED: `gnome-extensions` man page on Debian testing/Ubuntu Noble]

### Official Extensions Using This Pattern (VERIFIED)

Two official GNOME Shell extensions ship dual stylesheets: [VERIFIED: Arch Linux package file listing for `gnome-shell-extensions` 49.0]

1. **window-list** (`window-list@gnome-shell-extensions.gcampax.github.com`)
   - `stylesheet-dark.css`, `stylesheet-light.css`
   - Also: `stylesheet-workspace-switcher-dark.css`, `stylesheet-workspace-switcher-light.css`

2. **workspace-indicator** (`workspace-indicator@gnome-shell-extensions.gcampax.github.com`)
   - `stylesheet-dark.css`, `stylesheet-light.css`

### CRITICAL: Manual Stylesheet Loading Conflict

The current `extension.js` has manual `_loadStylesheet()` / `_unloadStylesheet()` methods (lines 93-116) that explicitly load `stylesheet.css`. Since GNOME Shell's `extensionSystem.js` already loads the stylesheet automatically during `_callExtensionEnable()`, this creates **double loading** -- the same CSS rules applied twice.

**When adopting dual stylesheets:**
1. GNOME Shell will load `stylesheet-dark.css` or `stylesheet-light.css` automatically
2. The extension's manual `_loadStylesheet()` would additionally load `stylesheet.css`
3. This would apply **both** the variant stylesheet AND the fallback, causing style conflicts

**Action required:** Remove `_loadStylesheet()`, `_unloadStylesheet()`, and `this._stylesheetFile` from `extension.js`. Let GNOME Shell handle all stylesheet loading. [VERIFIED: source code analysis of both extensionSystem.js and extension.js]

## St CSS Engine Limitations

### Unsupported Features (VERIFIED)

| Feature | Supported? | Source |
|---------|-----------|--------|
| CSS custom properties (`var()`) | NO | [VERIFIED: Federico's blog post on GNOME CSS implementations] |
| `calc()` | NO | [VERIFIED: same source] |
| `@media` queries | NO | [VERIFIED: same source] |
| `@define-color` | NO (GTK-only) | [VERIFIED: same source] |
| `env()` | NO | [VERIFIED: same source] |
| `color-mix()` | NO (libadwaita only, not St) | [VERIFIED: libadwaita 1.6 docs] |
| CSS nesting | NO | [ASSUMED] |
| `@import` | YES (limited) | [VERIFIED: session-specific stylesheets use `@import`] |

### Supported Features (VERIFIED)

Based on `st-theme-node.c` API and real-world GNOME Shell CSS files: [CITED: developer-old.gnome.org/st/stable/st-st-theme-node.html]

**Properties confirmed working in current extension's stylesheet:**
- `background-color`, `color` (solid and rgba)
- `border`, `border-color`, `border-radius`, `border-left`
- `padding`, `margin`, `spacing`
- `font-size`, `font-weight`
- `width`, `height`, `min-width`
- `opacity`
- `icon-size`
- `-natural-hpadding`, `-minimum-hpadding` (St-specific)

**Pseudo-classes:** `:hover`, `:active`, `:checked`, `:focus`, `:selected`, `:insensitive`

**Selectors:** Element type selectors (`StLabel`), class selectors (`.class-name`), descendant combinators (`.parent .child`), direct child not supported.

### Consequence for Theme Support

Since St lacks `var()`, `@media (prefers-color-scheme)`, and all dynamic CSS features, the ONLY mechanism for dark/light support is **separate stylesheet files**. This is exactly what GNOME Shell's dual-stylesheet mechanism provides. There is no alternative.

## Color Palette: Light Theme

### Current Dark Theme Colors (Reference)

The current `stylesheet.css` uses a One Dark-inspired palette:

| Role | Hex | Usage |
|------|-----|-------|
| Badge background | `rgba(40, 44, 52, 0.92)` | Provider pill background |
| Badge border | `rgba(171, 178, 191, 0.16)` | Provider pill border |
| Primary text | `#e6edf3` | Usage numbers, headers |
| Secondary text | `#d7dae0` | Usage details |
| Muted text | `#abb2bf` | Provider default text |
| Placeholder text | `#7f848e` | Loading/idle state |
| Popup background | `rgba(33, 37, 43, 0.98)` | Dropdown menu |
| Codex blue | `#61afef` | Provider accent |
| Claude yellow | `#e5c07b` | Provider accent |
| Copilot green | `#98c379` | Provider accent |
| Error red | `#e06c75` | Error state |

### WCAG Contrast Analysis (VERIFIED)

All contrast ratios computed using WCAG 2.0 relative luminance formula: [VERIFIED: computed via Python implementation of W3C algorithm]

**Current dark theme (all pass):**

| Color | Background | Ratio | Status |
|-------|-----------|-------|--------|
| `#abb2bf` | `#282c34` | 6.57:1 | AA PASS |
| `#e6edf3` | `#282c34` | 11.85:1 | AA PASS |
| `#e5c07b` | `#282c34` | 8.10:1 | AA PASS |
| `#98c379` | `#282c34` | 6.94:1 | AA PASS |
| `#61afef` | `#282c34` | 5.92:1 | AA PASS |

**Original One Dark colors on white (#ffffff) -- ALL FAIL:**

| Color | Ratio vs White | Status |
|-------|---------------|--------|
| `#e5c07b` (yellow) | 1.73:1 | FAIL (need 4.5:1) |
| `#98c379` (green) | 2.02:1 | FAIL |
| `#61afef` (blue) | 2.36:1 | FAIL |
| `#e06c75` (red) | 3.20:1 | FAIL for normal text |

### Recommended Light Theme Provider Colors (VERIFIED)

Colors darkened via HSL lightness reduction to pass WCAG AA (4.5:1) for normal-size text on white: [VERIFIED: computed with exact WCAG luminance formula]

| Provider | Dark Theme | Light Theme | Lightness Delta | Ratio vs #fff |
|----------|-----------|-------------|-----------------|---------------|
| Codex (blue) | `#61afef` | `#1579cb` | L 66% -> 44% (-22) | 4.54:1 AA PASS |
| Claude (yellow) | `#e5c07b` | `#996e1e` | L 69% -> 36% (-33) | 4.56:1 AA PASS |
| Copilot (green) | `#98c379` | `#567f39` | L 62% -> 36% (-26) | 4.68:1 AA PASS |
| Error (red) | `#e06c75` | `#d63e4a` | L 65% -> 54% (-11) | 4.52:1 AA PASS |

**Intermediate accent colors** for border stripes and decorative elements (3:1 minimum for UI components):

| Provider | Accent Color | Ratio vs #fff | Status |
|----------|-------------|---------------|--------|
| Codex (blue) | `#3799ea` | 3.04:1 | UI component PASS |
| Claude (yellow) | `#bf8a25` | 3.05:1 | UI component PASS |
| Copilot (green) | `#6da148` | 3.07:1 | UI component PASS |
| Error (red) | `#e06c75` | 3.20:1 | UI component PASS (original works) |

### Complete Light Theme Palette

Based on GNOME HIG neutral colors [CITED: gnome-shell-sass `_palette.scss`] and Adwaita conventions [CITED: gnome.pages.gitlab.gnome.org/libadwaita/doc/main/css-variables.html]:

**Structural colors:**

| Role | Value | Source |
|------|-------|--------|
| Badge background | `rgba(255, 255, 255, 0.92)` | Inverted from dark; matches Adwaita light |
| Badge border | `rgba(0, 0, 0, 0.12)` | Inverted from dark |
| Primary text | `#2e3436` | GNOME HIG: Adwaita `$fg_color` [VERIFIED: _colors.scss] |
| Secondary text | `#3d3846` | GNOME HIG: `$dark_3` [VERIFIED: _palette.scss] |
| Muted text | `#5e5c64` | GNOME HIG: `$dark_2` [VERIFIED: _palette.scss] |
| Placeholder text | `#9a9996` | GNOME HIG: `$light_5` [VERIFIED: _palette.scss] |
| Popup background | `rgba(255, 255, 255, 0.98)` | Inverted from dark |
| Popup border | `rgba(0, 0, 0, 0.12)` | Inverted from dark |
| Card/row background | `rgba(0, 0, 0, 0.04)` | Subtle tint on white |
| Summary item bg | `rgba(0, 0, 0, 0.03)` | Even lighter than cards |
| Summary item border | `rgba(21, 121, 203, 0.12)` | Blue tint, matches dark |
| Progress track | `rgba(0, 0, 0, 0.08)` | Neutral track |
| Unavailable/idle bg | `rgba(0, 0, 0, 0.03)` | Subtle depression |
| Unavailable/idle border | `rgba(0, 0, 0, 0.08)` | Muted border |

**Text contrast verification against Adwaita backgrounds:** [VERIFIED: computed]

| Text Color | vs #ffffff | vs #fafafa | vs #f6f5f4 |
|-----------|-----------|-----------|-----------|
| `#2e3436` | 12.65:1 | 12.12:1 | 11.61:1 |
| `#3d3846` | 11.34:1 | 10.86:1 | 10.41:1 |
| `#5e5c64` | 6.72:1 | 6.44:1 | 6.17:1 |
| `#9a9996` | 2.92:1 | 2.80:1 | 2.68:1 |

Note: `#9a9996` (placeholder text) does not pass 4.5:1 against white. This is intentional -- placeholder text indicates non-interactive/loading state and uses the same approach as GNOME's own `$light_5` for disabled/insensitive text. The GNOME HIG itself uses this color for this purpose.

**Provider accent colors (for borders, icon tints, progress fills):**

| Provider | Text Color | Accent/Border Color | Icon Box Background |
|----------|-----------|-------------------|-------------------|
| Codex | `#1579cb` | `#3799ea` | `rgba(21, 121, 203, 0.10)` |
| Claude | `#996e1e` | `#bf8a25` | `rgba(153, 110, 30, 0.10)` |
| Copilot | `#567f39` | `#6da148` | `rgba(86, 127, 57, 0.10)` |

**Status state colors (light theme):**

| State | Border Color | Background |
|-------|-------------|-----------|
| OK | `rgba(86, 127, 57, 0.36)` | `rgba(255, 255, 255, 0.96)` |
| Degraded | `rgba(153, 110, 30, 0.42)` | `rgba(153, 110, 30, 0.04)` |
| Error | `rgba(214, 62, 74, 0.48)` | `rgba(214, 62, 74, 0.04)` |
| Error text | `#d63e4a` | -- |
| Loading border | `rgba(21, 121, 203, 0.36)` | -- |

## Common Pitfalls

### Pitfall 1: Double Stylesheet Loading
**What goes wrong:** Extension loads `stylesheet.css` manually while GNOME Shell also loads a variant file, resulting in both being applied simultaneously with conflicting rules.
**Why it happens:** The extension was written before the dual-stylesheet mechanism existed or without awareness of it.
**How to avoid:** Remove all manual stylesheet loading from `extension.js`. Trust `extensionSystem.js` to handle it.
**Warning signs:** Styles appear doubled, border widths seem 2x expected, or toggling theme causes visual glitches.

### Pitfall 2: Fallback File Gets "Stuck"
**What goes wrong:** If `stylesheet.css` is loaded as fallback (e.g., on first install before variant files exist), toggling light/dark does NOT trigger a reload because `_reloadExtensionStylesheets()` only reloads files ending in `-dark.css` or `-light.css`.
**Why it happens:** The reload logic explicitly checks `path.endsWith('-dark.css') || path.endsWith('-light.css')`.
**How to avoid:** Always ship both variant files alongside the fallback. The fallback is only for pre-46 shells, not for missing variant scenarios.
**Warning signs:** Theme toggle has no effect on extension appearance.

### Pitfall 3: Using Original Brand Colors in Light Theme
**What goes wrong:** Provider colors that look great on dark backgrounds become invisible on light backgrounds. Yellow `#e5c07b` has only 1.73:1 contrast against white.
**Why it happens:** The same colors that provide good contrast against dark (#282c34) backgrounds naturally fail against light backgrounds.
**How to avoid:** Use the darkened variant colors computed in this research. Test with WCAG contrast checker.
**Warning signs:** Text appears washed out or unreadable in light mode.

### Pitfall 4: Assuming `rgba()` Alpha Composites the Same Way
**What goes wrong:** `rgba(40, 44, 52, 0.92)` on dark panel looks rich and opaque. The same alpha on light panel looks different because the base color underneath changed.
**Why it happens:** Alpha compositing depends on the background color the element sits on.
**How to avoid:** Test badge appearance against actual GNOME Shell panel backgrounds (near-white for light, near-black for dark). Use near-full opacity for the light variant.
**Warning signs:** Elements appear washed out or too transparent.

### Pitfall 5: St CSS `border-left` Shorthand Quirks
**What goes wrong:** Some St CSS shorthand properties behave differently from web CSS. Complex shorthand declarations may be silently ignored.
**Why it happens:** St's CSS parser is a subset implementation (libcroco-based) that doesn't handle all CSS shorthand expansions.
**How to avoid:** Prefer longhand properties when behavior is unexpected. The current stylesheet's `border-left: 3px solid #color` pattern works, but test thoroughly.
**Warning signs:** Borders or other properties silently not applying.

## Architecture Patterns

### Recommended File Structure

```
apps/gnome-extension/
  stylesheet-dark.css         # One Dark palette (renamed from current stylesheet.css)
  stylesheet-light.css        # Adwaita-compatible light palette (NEW)
  stylesheet.css              # Copy of stylesheet-dark.css (fallback for pre-46)
  extension.js                # MODIFIED: remove _loadStylesheet/_unloadStylesheet
```

### Pattern: Dual-Stylesheet with Shared Class Names

Both `stylesheet-dark.css` and `stylesheet-light.css` use **identical selectors** (BEM class names) with different color values. The layout properties (spacing, padding, border-radius, font-size, icon-size) are identical between both files. Only color-related properties differ:

- `background-color`
- `color`
- `border-color` / `border-left`
- `opacity` (may differ slightly for visibility)

### Anti-Patterns to Avoid

- **Trying to use CSS variables for theming:** St does not support `var()`. Period.
- **Single stylesheet with class toggles:** Would require JavaScript to detect theme and add/remove classes. The built-in mechanism is better.
- **Loading both dark and light stylesheets simultaneously:** Never do this. The extension system's priority cascade means only ONE file is loaded.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Theme detection | JavaScript GSettings listener + class toggling | GNOME Shell's built-in `extensionSystem.js` dual-stylesheet | Already handles signal connections, stylesheet swapping, and cleanup |
| Color-scheme monitoring | `Gio.Settings` watcher for `org.gnome.desktop.interface` | Built-in `St.Settings` `notify::color-scheme` signal | Already wired in extension system; handles all edge cases (forced modes, session modes) |
| CSS preprocessing | Build-time SCSS compilation for light/dark | Two plain CSS files | St doesn't support SCSS; the extension is small enough (219 lines) that two files are manageable |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | CSS nesting is not supported in St | St CSS Limitations | LOW -- if supported, would simplify stylesheets but no current usage depends on it |
| A2 | Ubuntu 24.04 default session mode uses `prefer-dark` colorScheme | Variant Resolution | MEDIUM -- if different, variant resolution logic differs. Verified against GNOME Shell 46 source; Ubuntu uses stock GNOME Shell session mode |
| A3 | `#9a9996` placeholder text at 2.92:1 is acceptable for non-interactive text | Color Palette | LOW -- follows GNOME HIG precedent for insensitive/disabled state colors |

## Open Questions (RESOLVED)

1. **Ubuntu 24.04 Yaru Theme Panel Background** (RESOLVED)
   - What we know: Default GNOME Shell light panel is near-white. Ubuntu may use Yaru theme which has a slightly different panel treatment.
   - What's unclear: Exact Yaru light panel background color on Ubuntu 24.04 (may be slightly warm-tinted rather than pure white).
   - Resolution: Using `rgba(255, 255, 255, 0.92)` which composites correctly against any light background. Visual verification deferred to manual testing on Ubuntu 24.04.

2. **Session-Mode Variant Files** (RESOLVED)
   - What we know: The resolution tries `user-dark.css` before `stylesheet-dark.css`.
   - What's unclear: Whether Ubuntu's session mode string differs from standard `'user'`.
   - Resolution: Using `stylesheet-dark.css` / `stylesheet-light.css` naming. The `user-*` prefix pattern is for specialized session modes (e.g., GNOME Classic). Standard GNOME Shell on Ubuntu uses `'user'` session mode.

## Environment Availability

Step 2.6: SKIPPED (no external dependencies identified). This is a CSS-only change with extension.js cleanup -- no external tools, services, or runtimes beyond what the project already uses.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Manual visual testing + GNOME Shell restart |
| Config file | none -- CSS changes require visual verification |
| Quick run command | `gnome-extensions disable agent-bar-ubuntu@noctua.dev && gnome-extensions enable agent-bar-ubuntu@noctua.dev` |
| Full suite command | Toggle system theme: `gsettings set org.gnome.desktop.interface color-scheme 'prefer-light'` and `gsettings set org.gnome.desktop.interface color-scheme 'prefer-dark'` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| HARD-03 | Dark stylesheet loads on dark theme | manual | `gsettings set org.gnome.desktop.interface color-scheme 'prefer-dark'` | N/A |
| HARD-03 | Light stylesheet loads on light theme | manual | `gsettings set org.gnome.desktop.interface color-scheme 'prefer-light'` | N/A |
| HARD-03 | Theme swap without extension restart | manual | Toggle gsettings while extension is running | N/A |
| HARD-03 | Fallback stylesheet.css on pre-46 | manual-only | Requires GNOME Shell < 46 environment | N/A |
| HARD-03 | WCAG AA contrast in light mode | manual | Visual inspection of text readability | N/A |

### Sampling Rate
- **Per task commit:** Visual verification by toggling theme
- **Per wave merge:** Full dark/light/swap cycle test
- **Phase gate:** Both themes verified readable before `/gsd-verify-work`

### Wave 0 Gaps
None -- CSS changes do not require automated test infrastructure. Visual verification is the appropriate test type.

## Security Domain

Not applicable to this research focus (CSS stylesheet changes). Security enforcement is relevant to other phase 14 requirements (QUAL-01, HARD-01, HARD-04) but not to HARD-03 theme awareness.

## Sources

### Primary (HIGH confidence)
- [GNOME Shell 46 extensionSystem.js](https://gitlab.gnome.org/GNOME/gnome-shell/-/raw/46.0/js/ui/extensionSystem.js) -- `_loadExtensionStylesheet`, `_reloadExtensionStylesheets`, `_callExtensionEnable` source code
- [GNOME Shell 46 main.js](https://gitlab.gnome.org/GNOME/gnome-shell/-/raw/46.0/js/ui/main.js) -- `getStyleVariant()` source code
- [gnome-shell-sass _palette.scss](https://gitlab.gnome.org/GNOME/gnome-shell-sass/-/raw/master/_palette.scss) -- GNOME HIG color palette ($light_1 through $dark_5)
- [gnome-shell-sass _colors.scss](https://gitlab.gnome.org/GNOME/gnome-shell-sass/-/raw/master/_colors.scss) -- Adwaita $fg_color, $bg_color, $base_color definitions
- [window-list extension dark stylesheet](https://gitlab.gnome.org/GNOME/gnome-shell-extensions/-/raw/46.0/extensions/window-list/stylesheet-dark.css) -- Official extension dual-stylesheet reference
- [window-list extension light stylesheet](https://gitlab.gnome.org/GNOME/gnome-shell-extensions/-/raw/46.0/extensions/window-list/stylesheet-light.css) -- Official extension dual-stylesheet reference
- [Arch Linux gnome-shell-extensions file listing](https://archlinux.org/packages/extra/any/gnome-shell-extensions/files/) -- Confirms window-list and workspace-indicator ship dual stylesheets
- [gnome-extensions man page](https://manpages.debian.org/testing/gnome-shell/gnome-extensions.1.en.html) -- Documents stylesheet-dark.css/stylesheet-light.css in pack command
- WCAG contrast ratios -- Computed via Python implementation of W3C relative luminance algorithm

### Secondary (MEDIUM confidence)
- [Federico's blog: GNOME themes status report](https://viruta.org/gnome-themes.html) -- St CSS limitations (no var(), no calc(), no @media)
- [GNOME Shell styling PSA](https://blogs.gnome.org/shell-dev/2023/07/26/gnome-shell-styling-changes-a-psa-for-theme-authors/) -- Light variant introduction timeline
- [libadwaita CSS Variables docs](https://gnome.pages.gitlab.gnome.org/libadwaita/doc/main/css-variables.html) -- Adwaita color reference values
- [gjs.guide Extension Anatomy](https://gjs.guide/extensions/overview/anatomy.html) -- Extension structure documentation
- [StThemeNode reference](https://developer-old.gnome.org/st/stable/st-st-theme-node.html) -- Supported St CSS properties API

### Tertiary (LOW confidence)
- [UX Design: Dark Yellow Problem](https://uxdesign.cc/the-dark-yellow-problem-in-design-system-color-palettes-a0db1eedc99d) -- Context on why yellow accessibility is fundamentally challenging

## Metadata

**Confidence breakdown:**
- Dual-stylesheet mechanism: HIGH -- verified from GNOME Shell 46 source code
- Color palette: HIGH -- computed with WCAG algorithm, cross-verified with multiple methods
- St CSS limitations: HIGH -- verified from official GNOME developer sources
- Manual loading conflict: HIGH -- verified by reading both extensionSystem.js and extension.js
- Light theme Adwaita colors: MEDIUM -- palette values verified from source, but compiled panel color not extracted from actual Ubuntu 24.04 installation

**Research date:** 2026-04-05
**Valid until:** 2026-07-05 (GNOME Shell 46 is stable; Ubuntu 24.04 LTS is frozen)
