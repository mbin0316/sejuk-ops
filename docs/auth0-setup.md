# Auth0 setup

About 15 minutes in the Auth0 dashboard (free tenant). Do the steps in order.

## 1. Create the API

**Applications → APIs → Create API**

| Field | Value |
|---|---|
| Name | `Sejuk Ops API` |
| Identifier (audience) | `https://sejuk-ops/api` |
| Signing algorithm | RS256 |

Then open the API's **Settings**:
- **Enable RBAC**: on
- **Allow Offline Access**: on (needed for refresh tokens, which keep technicians signed in on phones)

## 2. Create the application

**Applications → Applications → Create Application → Single Page Web Applications**, name `Sejuk Ops`.

In **Settings**, set each of these to both URLs, comma-separated (add your Vercel URL once you have it):

```
http://localhost:5173, https://YOUR-APP.vercel.app
```

- Allowed Callback URLs
- Allowed Logout URLs
- Allowed Web Origins

Under **Refresh Token Rotation**, turn **Rotation** on. Save.

Then let the app call the API for signed-in users (newer tenants block this by default):
**Applications → APIs → Sejuk Ops API → Application Access** tab → **User access** → authorize the `Sejuk Ops` application (or set the policy to allow all applications). Save.

Copy the **Domain** and **Client ID** for step 6.

## 3. Close public sign-up

**Authentication → Database → Username-Password-Authentication → Settings → Disable Sign Ups**: on.
Only accounts you create can sign in.

## 4. Create roles

**User Management → Roles → Create Role**, three times. Use these exact names (lowercase):

| Name | Description |
|---|---|
| `admin` | Creates orders and assigns technicians |
| `technician` | Completes assigned jobs |
| `manager` | Reviews jobs, KPIs and AI assistant |

## 5. Add the login Action

**Actions → Library → Create Action → Build from scratch**, name `Add Sejuk Ops claims`, trigger **Login / Post Login**.
Replace the code with [`auth0/post-login-action.js`](../auth0/post-login-action.js), click **Deploy**.

Then **Actions → Triggers → post-login**, drag the Action between Start and Complete, click **Apply**.

## 6. Create the demo users

**User Management → Users → Create User** (connection: Username-Password-Authentication). Choose your own passwords.

| Email | Role | app_metadata |
|---|---|---|
| `admin@sejuk-ops.com` | admin | `{}` |
| `manager@sejuk-ops.com` | manager | `{}` |
| `ali@sejuk-ops.com` | technician | `{ "technician": "Ali" }` |
| `john@sejuk-ops.com` | technician | `{ "technician": "John" }` |
| `bala@sejuk-ops.com` | technician | `{ "technician": "Bala" }` |
| `yusoff@sejuk-ops.com` | technician | `{ "technician": "Yusoff" }` |

For each user:
1. **Roles** tab → **Assign Roles** → pick the role.
2. **Details** tab → **app_metadata** → paste the JSON (technicians only) → **Save**.
3. Optional: set **Name** (e.g. "Ali") so it shows nicely in audit logs.

## 7. Environment variables

Create `.env.local` in the project root (it is git-ignored):

```env
VITE_AUTH0_DOMAIN=YOUR-TENANT.us.auth0.com
VITE_AUTH0_CLIENT_ID=YOUR_CLIENT_ID
VITE_AUTH0_AUDIENCE=https://sejuk-ops/api

AUTH0_DOMAIN=YOUR-TENANT.us.auth0.com
AUTH0_AUDIENCE=https://sejuk-ops/api
```

Add the same five variables in **Vercel → Project → Settings → Environment Variables**.

Restart `npm run dev`, open http://localhost:5173 and sign in as each demo user.

## Troubleshooting

| Symptom | Fix |
|---|---|
| "No access yet" after signing in | The user has no role, or the Action isn't in the post-login trigger. Sign out and in again after fixing. |
| `Callback URL mismatch` | The exact origin (`http://localhost:5173`) is missing from Allowed Callback URLs. |
| API returns 401 "Invalid or expired access token" | `AUTH0_AUDIENCE` and `VITE_AUTH0_AUDIENCE` must both equal the API identifier, character for character. |
| `Client "…" is not authorized to access resource server` | The app isn't authorized for user access on the API (end of step 2). |
| `Missing Refresh Token` | Turn on **Allow Offline Access** on the API (step 1). |
