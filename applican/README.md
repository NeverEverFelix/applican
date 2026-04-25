# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

## Supabase Edge Function: `generate-bullets`

This project includes an edge function at:

- `supabase/functions/generate-bullets/index.ts`

### Deploy

```bash
supabase functions deploy generate-bullets --project-ref gvfiiqggcxpitswxloqb
```

### Required function secrets

```bash
supabase secrets set \
  OPENAI_API_KEY=your_openai_api_key \
  SUPABASE_SERVICE_ROLE_KEY=your_service_role_key \
  --project-ref gvfiiqggcxpitswxloqb
```

Optional:

```bash
supabase secrets set OPENAI_MODEL=gpt-4.1 --project-ref gvfiiqggcxpitswxloqb
```

Sentry (Edge Functions):

```bash
supabase secrets set \
  SENTRY_DSN=your_edge_function_sentry_dsn \
  SENTRY_ENVIRONMENT=production \
  SENTRY_TRACES_SAMPLE_RATE=0.1 \
  SENTRY_DEBUG=false \
  --project-ref gvfiiqggcxpitswxloqb
```

Optional release tag for grouping:

```bash
supabase secrets set SENTRY_RELEASE=applican@$(git rev-parse --short HEAD) --project-ref gvfiiqggcxpitswxloqb
```

## Supabase Edge Function: `generate-tailored-resume`

This project includes an edge function at:

- `supabase/functions/generate-tailored-resume/index.ts`

### Deploy

```bash
supabase functions deploy generate-tailored-resume --project-ref gvfiiqggcxpitswxloqb
```

### Required function secrets

```bash
supabase secrets set \
  SUPABASE_SERVICE_ROLE_KEY=your_service_role_key \
  --project-ref gvfiiqggcxpitswxloqb
```

## Stripe Production Checklist

Stripe billing is already wired through these edge functions:

- `supabase/functions/create-checkout-session`
- `supabase/functions/create-portal-session`
- `supabase/functions/cancel-subscription`
- `supabase/functions/stripe-webhook`

### 1. Set the correct production app URL

Your Stripe return URLs are built from `APP_URL`. In production this must be the public frontend origin, for example:

```bash
supabase secrets set APP_URL=https://applican.com --project-ref gvfiiqggcxpitswxloqb
```

Do not leave `APP_URL` pointed at `http://localhost:5173` in production.

### 2. Set Stripe secrets in Supabase

```bash
supabase secrets set \
  STRIPE_SECRET_KEY=sk_live_... \
  STRIPE_PRO_PRICE_ID=price_... \
  STRIPE_WEBHOOK_SECRET=whsec_... \
  APP_URL=https://applican.com \
  SUPABASE_SERVICE_ROLE_KEY=your_service_role_key \
  --project-ref gvfiiqggcxpitswxloqb
```

### 3. Deploy the Stripe edge functions

```bash
supabase functions deploy create-checkout-session --project-ref gvfiiqggcxpitswxloqb
supabase functions deploy create-portal-session --project-ref gvfiiqggcxpitswxloqb
supabase functions deploy cancel-subscription --project-ref gvfiiqggcxpitswxloqb
supabase functions deploy stripe-webhook --project-ref gvfiiqggcxpitswxloqb
```

### 4. Point Stripe webhooks at Supabase

Create a Stripe webhook endpoint for:

```text
https://gvfiiqggcxpitswxloqb.supabase.co/functions/v1/stripe-webhook
```

Subscribe at minimum to:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

Use the endpoint signing secret from Stripe as `STRIPE_WEBHOOK_SECRET`.

### 5. Verify the database side is applied

Make sure the billing migrations are applied before testing live checkout, especially the ones that create:

- `billing_customers`
- `billing_usage`
- `entitlements`
- `billing_events`
- `set_billing_customer`
- `set_entitlement_subscription`
- `set_user_plan`

### 6. Test the full live flow

1. Sign in as a normal free user.
2. Start checkout from the app.
3. Complete payment in Stripe.
4. Confirm the user lands back on `/app` and the plan updates to `pro`.
5. Open billing portal from the app and confirm cancel/resume actions sync back through the webhook.

### 7. Rotate exposed secrets if needed

If live Stripe or Supabase secrets were ever committed, pushed, screenshotted, or shared outside your machine, rotate them before launch.
