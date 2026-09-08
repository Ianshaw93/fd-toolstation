# FD Fee Proposal: Word add-in

Task pane for desktop Word that builds the Fire Dynamics fee proposal letter from the same
form as the web tool: fill in the form, press Generate, and the letter opens as a new Word
document. (The insert-in-place and stored-inputs mechanics live on in `lib/word-ops.ts`
for the section experiments, not in the fee pane.)

The shareable add-in is the fee proposal only. The sections and citations experiments
(warehouse appendix fragments, Word-native references, local-AI citation finder) stay in
the code behind `?dev=1` on the pane URL, which only the localhost manifest uses.

## Pieces

| Piece | Where |
| --- | --- |
| Pane page | `app/addin/word/page.tsx` |
| Fee form in the pane | `components/addin/FeeProposalPane.tsx` (reuses `components/fee-proposal/*`) |
| Word JS operations | `lib/word-ops.ts` (createDocument, insertFileFromBase64 in a tagged content control, state in a custom XML part) |
| Backend calls | `lib/word-addin-api.ts` (same-origin `/backend/...`, rewritten in `next.config.ts`) |
| Production manifest | `addin/manifest.word.xml` (Vercel app) |
| Local manifest | `addin/manifest.word.localhost.xml` (https://localhost:3100, dev tools on) |
| Backend | backendForNextApp `routers/word_fee.py` at `/word/fee-proposal/render` (self-contained; the dev router `routers/word_addin.py` is optional) |

The pane falls back to the web tool's `/fee-proposals/generate` when the backend does not
have the add-in endpoint yet, so "New document" works against today's Railway deploy.

## Ship it

1. Backend: cherry-pick the commit that adds `routers/word_fee.py` and its two lines in
   `main.py` onto `master` (Railway deploys master). It has no other dependencies.
2. Frontend: merge `word-addin` into `main` (Vercel deploys main). `next.config.ts` defaults
   the `/backend` rewrite to Railway when `BACKEND_URL` is unset. Icons are in
   `public/addin/word/`.
3. Check https://fd-toolstation.vercel.app/addin/word loads (preview mode in a browser) and
   https://fd-toolstation.vercel.app/backend/fee-proposals/engineers returns the list.
4. Microsoft 365 admin center > Settings > Integrated apps > Upload custom apps > Office
   Add-in > `addin/manifest.word.xml`. Assign to the team. It appears in Word within a few
   hours as **Fee Proposal** on the Home tab.

Manifest changes need a re-upload; pane code changes deploy with the app.

## Run locally

```powershell
# backend (worktree backendForNextApp-worktrees/word-addin)
..\..\backendForNextApp\.venv\Scripts\python.exe -m uvicorn main:app --reload --port 8100
# pane (this worktree); --webpack because node_modules is a junction Turbopack rejects
npx next dev --webpack --experimental-https -p 3100
pwsh addin/sideload-word.ps1     # once; registers the localhost manifest, then restart Word
```

## Known gaps

- Insert at cursor brings the body only: Word drops an inserted file's headers and footers,
  so the merged letterhead comes through the New document route.
- The stage tables are wide for a task pane and scroll sideways; a stacked layout is the
  next UI job.
- Not committed yet on either worktree.
