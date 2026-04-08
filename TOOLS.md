# TOOLS.md - Local Notes

Skills define _how_ tools work. This file is for _your_ specifics — the stuff that's unique to your setup.

## What Goes Here

Things like:

- Camera names and locations
- SSH hosts and aliases
- Preferred voices for TTS
- Speaker/room names
- Device nicknames
- Anything environment-specific

## Examples

```markdown
### Cameras

- living-room → Main area, 180° wide angle
- front-door → Entrance, motion-triggered

### SSH

- home-server → 192.168.1.100, user: admin

### TTS

- Preferred voice: "Nova" (warm, slightly British)
- Default speaker: Kitchen HomePod
```

## Why Separate?

Skills are shared. Your setup is yours. Keeping them apart means you can update skills without losing your notes, and share skills without leaking your infrastructure.

---

### Google Workspace (gog)

- **Binary:** `~/.local/bin/gog`
- **Account:** batublockchain@gmail.com
- **Services:** Gmail, Calendar, Drive, Contacts, Docs, Sheets
- **Auth:** OAuth tokens stored in `~/.config/gogcli/` — already authorized, no re-auth needed
- **Env var (optional):** `GOG_ACCOUNT=batublockchain@gmail.com` para no repetir `--account` en cada comando

**Comandos clave:**
```bash
# Gmail
~/.local/bin/gog gmail search 'newer_than:7d' --max 10
~/.local/bin/gog gmail send --to x@y.com --subject "Asunto" --body "Cuerpo"

# Calendar
~/.local/bin/gog calendar events primary --from 2026-04-08 --to 2026-04-15
~/.local/bin/gog calendar create primary --summary "Título" --from 2026-04-09T10:00:00-05:00 --to 2026-04-09T11:00:00-05:00

# Sheets
~/.local/bin/gog sheets get <sheetId> "Tab!A1:D10" --json
~/.local/bin/gog sheets update <sheetId> "Tab!A1:B2" --values-json '[["A","B"],["1","2"]]'

# Drive
~/.local/bin/gog drive search "query" --max 10

# Docs
~/.local/bin/gog docs cat <docId>
```

**Nota:** El PATH de los crons puede no incluir `~/.local/bin`. Usar ruta absoluta: `/home/openclaw-project/.local/bin/gog`

---

Add whatever helps you do your job. This is your cheat sheet.
