# fd-toolstation

## Deployment

- **Frontend (Vercel):** https://fd-toolstation.vercel.app
- **Backend (Railway):** https://backendfornextapp-production.up.railway.app
- **Backend repo:** https://github.com/Ianshaw93/backendForNextApp
- **Backend local path:** C:\Users\IanShaw\OneDrive - Fire Dynamics Group Limited\Documents\Programming\fastApi

## Environment Variables

- `NEXT_PUBLIC_API_URL` - Backend API URL. Set in Vercel for production. Falls back to Railway URL if unset.
- Local dev uses `.env.local` with `http://localhost:8000`
