# FD Fee Proposal: Word add-in

Task pane for desktop Word that builds the Fire Dynamics fee proposal letter from the same
form as the web tool: fill in the form, press Generate, and the letter opens as a new Word
document. The RIBA stage tables are stacked cards in the pane (`components/addin/StageCards.tsx`)
because the pane is 320 px wide by default; the web tool keeps its table. (The
insert-in-place and stored-inputs mechanics live on in `lib/word-ops.ts` for the section
experiments, not in the fee pane.)

The shareable add-in is the fee proposal only. The sections and citations experiments
(warehouse appendix fragments, Word-native references, local-AI citation finder) stay in
the code behind `?dev=1` on the pane URL, which only the localhost manifest uses.

## Pieces

| Piece | Where |
| --- | --- |
| Pane page | `app/addin/word/page.tsx` |
| Fee form in the pane | `components/addin/FeeProposalPane.tsx` (reuses `components/fee-proposal/*`; stages via `StageCards` + `ServiceCard`) |
| Word JS operations | `lib/word-ops.ts` (createDocument, insertFileFromBase64 in a tagged content control, state in a custom XML part) |
| Backend calls | `lib/word-addin-api.ts` (same-origin `/backend/...`, rewritten in `next.config.ts`) |
| Production manifest | `addin/manifest.word.xml` (Vercel app) |
| Local manifest | `addin/manifest.word.localhost.xml` (https://localhost:3100, dev tools on) |
| Backend | backendForNextApp `routers/word_fee.py` at `/word/fee-proposal/render` (self-contained; the dev router `routers/word_addin.py` is optional) |

The pane falls back to the web tool's `/fee-proposals/generate` when the backend does not
have the add-in endpoint yet, so "New document" works against today's Railway deploy.

## Ship it (same route as the Mail Marshal Outlook add-in)

1. Backend: cherry-pick the commit that adds `routers/word_fee.py` and its two lines in
   `main.py` onto `master` (Railway deploys master). It has no other dependencies.
2. Frontend: merge `word-addin` into `main` (Vercel deploys main). `next.config.ts` defaults
   the `/backend` rewrite to Railway when `BACKEND_URL` is unset. Icons are in
   `public/addin/word/`.
3. Check https://fd-toolstation.vercel.app/addin/word loads (preview mode in a browser) and
   https://fd-toolstation.vercel.app/backend/fee-proposals/engineers returns the list.
4. Deploy the manifest into Exchange's organisation app catalogue, which is the list desktop
   Word reads. In PowerShell 7 (`pwsh`), with the ExchangeOnlineManagement module installed:

   ```powershell
   Connect-ExchangeOnline -UserPrincipalName <admin upn>
   $bytes = [IO.File]::ReadAllBytes('addin\manifest.word.xml')
   New-App -OrganizationApp -FileData $bytes -Enabled $true -DefaultStateForUser Enabled -ProvidedTo Everyone
   Get-App -OrganizationApp | Where-Object DisplayName -like 'FD*'
   ```

   It appears in desktop Word within a few hours as **Fee Proposal** on the Home tab; users
   may need to restart Word once. Later manifest changes go through `Set-App -OrganizationApp
   -Identity <id> -FileData $bytes`; removal through `Remove-App -OrganizationApp`.

   Gotchas found 9 Sep 2026: the admin center's Integrated apps upload showed "OK" but never
   reached Exchange, and `New-App` explained why: Exchange's manifest validator rejects a
   `<Requirements><Set Name="WordApi">` block (it only knows Outlook's sets). The manifests
   therefore carry no Requirements element; the pane checks `WordApi 1.3` at runtime instead.
   `<Version>` must be 1.0 or higher for the validator. Verify what Word will see with
   `Get-App -OrganizationApp`, and what a user sees with `Get-App -Mailbox <upn>`.

Manifest changes (name, icon URLs, button label, `Version`) need `Set-App`; pane code
changes deploy with the app. Bump `<Version>` when re-uploading.

No sign-in: the pane is public like the rest of fd-toolstation, and the backend is the same
Railway API the web tool calls.

## Run locally

```powershell
# backend (worktree backendForNextApp-worktrees/word-addin)
..\..\backendForNextApp\.venv\Scripts\python.exe -m uvicorn main:app --reload --port 8100
# pane (this worktree); --webpack because node_modules is a junction Turbopack rejects
npx next dev --webpack --experimental-https -p 3100
pwsh addin/sideload-word.ps1     # once; registers the localhost manifest, then restart Word
```

## Known gaps

- Word on the web and Mac are untested; the pane is plain HTML so they should work, but the
  icon cache and pane width differ.
- The dev tools (`?dev=1`) are still in the bundle, only hidden.
