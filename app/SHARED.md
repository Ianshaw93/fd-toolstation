# Shared Resources

Cross-cutting patterns and data sources used by multiple tools in the app.

## Engineer Names

Engineers are fetched from the backend API and displayed as a dropdown.

- **Endpoint:** `GET /fee-proposals/engineers`
- **API helper:** `lib/fee-api.ts` → `fetchEngineers()`
- **Type:** `Engineer` from `lib/fee-types.ts`

```ts
interface Engineer {
  full_name: string;
  email_prefix: string;
  phone_number: string;
  job_title: string;
}
```

### Usage pattern

```tsx
import { useState, useEffect } from 'react';
import { fetchEngineers } from '../../lib/fee-api';
import type { Engineer } from '../../lib/fee-types';

const [engineers, setEngineers] = useState<Engineer[]>([]);

useEffect(() => {
  fetchEngineers().then(setEngineers).catch(() => {});
}, []);

// In JSX:
<select value={value} onChange={handleChange}>
  <option value="">Select Engineer</option>
  {engineers.map((eng) => (
    <option key={eng.full_name} value={eng.full_name}>{eng.full_name}</option>
  ))}
</select>
```

### Used in
- `components/fee-proposal/FeeOptionsSection.tsx` (fee proposal tool)
- `components/efs/ProjectDetailsSection.tsx` (fire strategy tool)

## Shared Components

| Component | Path | Description |
|-----------|------|-------------|
| `CollapsibleSection` | `components/fee-proposal/CollapsibleSection.tsx` | Expandable/collapsible panel used across both fee-proposal and EFS tools |

## Backend

- **API URL:** configured via `NEXT_PUBLIC_API_URL` env var
- **Fallback:** `https://backendfornextapp-production.up.railway.app`
- **Backend repo:** https://github.com/Ianshaw93/backendForNextApp
