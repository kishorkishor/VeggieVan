# PLAN: Admin user management (create, change role, delete)

**Rank: 5 of 5.**

## Goal

`/admin/users` is read-only. Its own footer admits it: *"Roles cannot be changed in the UI
yet — edit directly via Prisma Studio"* (`app/admin/users/UsersClient.tsx`). For a project
whose README leads with a "role-aware admin panel … and users", this is the visible gap.

Add three admin-gated server actions — create user, change role, delete user — with the
safety rails a weaker model will forget: you can't delete yourself, you can't demote or
delete the last admin, and emails are normalized the same way the login path normalizes
them.

## Exact files to touch

| File | Change |
| --- | --- |
| `lib/users/actions.ts` | **New.** `"use server"` module: `createUserAction`, `setUserRoleAction`, `deleteUserAction`. |
| `app/admin/users/UsersClient.tsx` | Add create form, role toggle, delete button; remove the "cannot be changed in the UI yet" footer. |
| `app/admin/users/page.tsx` | No structural change; it already passes `users` + `currentEmail` and is `force-dynamic`. Exclude `passwordHash` from what reaches the client (see Step 3). |

## Step-by-step implementation order

### Step 1 — Server actions (`lib/users/actions.ts`)

Start the file with `"use server"`. Copy the `requireAdmin()` helper pattern from
`lib/products/actions.ts` (calls `auth()` from `@/auth`, checks
`session?.user?.role !== "admin"`). Import `bcrypt from "bcryptjs"` and
`prisma` from `@/lib/db`. All three actions return the repo's standard
`{ ok: true } | { ok: false; error: string }` shape and call
`revalidatePath("/admin/users")` on success.

**`createUserAction(input)`** — schema:

```ts
const createSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(100),
  role: z.enum(["admin", "staff"]),
});
```

- Hash with `await bcrypt.hash(password, 10)` — cost 10 matches `prisma/seed.ts`.
- `prisma.user.create({ data: { name, email, passwordHash, role } })`.
- Catch Prisma unique violation: `if ((e as { code?: string })?.code === "P2002")
  return { ok: false, error: "A user with that email already exists" };` — do not leak
  raw errors.

**`setUserRoleAction({ id, role })`** — schema: `id: z.string().min(1)`,
`role: z.enum(["admin", "staff"])`. Guards, in order:

1. `requireAdmin()`.
2. Load the target user; if missing → `"User not found"`.
3. If the target's email equals the session user's email → `"You cannot change your own
   role"` (compare emails: the session's `user.id` is a JWT-era id that may not match the
   DB cuid for Google-OAuth users, but email is stable — `session.user.email`).
4. If demoting an admin to staff: `const admins = await prisma.user.count({ where: {
   role: "admin" } })`; if `admins <= 1` and the target is an admin →
   `"Cannot demote the last admin"`.
5. Update.

**`deleteUserAction(id)`** — same guards 1–4 (self-delete → `"You cannot delete your own
account"`; last admin → `"Cannot delete the last admin"`), then `prisma.user.delete`.

### Step 2 — UI (`app/admin/users/UsersClient.tsx`)

The component already receives `users: User[]` and `currentEmail`, and gates on
`useIsAdmin()`. Add:

- **Create form** (top of page, inside a `card`): name, email, password, role select.
  Use plain controlled inputs + `useState` (this file doesn't use react-hook-form; match
  the repo's admin style — see `InventoryClient.tsx` for the pattern of calling server
  actions from a client component with `useTransition`/pending state and error text).
  On success clear the form. `router.refresh()` from `next/navigation` after success so
  the server-fetched list re-renders (the page is `force-dynamic`; `revalidatePath` alone
  does not refresh the currently mounted client route without a refresh).
- **Per-card controls**: a role select (admin/staff) wired to `setUserRoleAction`, and a
  delete button wired to `deleteUserAction` with a `window.confirm` guard. Disable both
  controls on the card where `isMe` is true (the existing `currentEmail === u.email`
  check), with a title tooltip explaining why.
- Surface `{ ok: false }` errors inline (small red text near the control), not `alert`.
- Delete the footer paragraph about Prisma Studio.
- Add a note near the role select: **"Role changes take effect at next sign-in"** — see
  edge cases.

### Step 3 — Stop shipping password hashes to the browser

`app/admin/users/page.tsx` currently does `prisma.user.findMany()` with no `select`, and
passes full `User` rows into a client component — **bcrypt password hashes are serialized
into the RSC payload today**. Fix while here:

```ts
users = await prisma.user.findMany({
  orderBy: { createdAt: "asc" },
  select: { id: true, email: true, name: true, role: true, createdAt: true },
});
```

Change `UsersClient`'s prop type from `User[]` to a matching `Pick<User, ...>[]`
(it only renders `email`, `name`, `role`).

## Edge cases found while exploring (easy to miss)

- **Password hashes currently reach the client** (Step 3). Even hashed, shipping them is
  wrong; this plan removes it.
- **JWT sessions mean role changes are not live.** Sessions are
  `strategy: "jwt"` (auth.config.ts) and `role` is baked into the token in the `jwt`
  callback at sign-in. Demoting a user does NOT strip their access until their token
  expires or they sign in again. Do not try to "fix" this by querying the DB in the
  middleware `authorized` callback — that callback runs on the **edge runtime** and must
  stay Prisma-free (the whole `auth.config.ts` / `auth.ts` split exists for this; see the
  comment at the top of auth.config.ts). Just disclose it in the UI.
- **Self-identification must use email, not id** — for Google OAuth sign-ins the JWT
  `id` comes from the provider profile, not the DB row.
- **Last-admin check has a race** (two admins demoting each other simultaneously). At this
  app's scale, the `count`-then-update in the action is acceptable; do not build advisory
  locks. Mention nothing in the UI.
- **Email normalization**: `findUserByEmail` lowercases + trims at login
  (`lib/admin-users.ts`). If `createUserAction` stores a mixed-case email, that user can
  never log in. The `.trim().toLowerCase()` in the Zod schema (Zod v3 supports both
  transforms on strings before `.email()`) is load-bearing.
- **Deleting a user does not invalidate their JWT** — same disclosure as role changes.
  Their session dies at token expiry.
- **Middleware already admin-gates `/admin/users`** (`adminOnly` list in auth.config.ts),
  and `UsersClient` renders `Forbidden` for staff — but server actions are directly
  invokable HTTP endpoints, so every action still needs its own `requireAdmin()`. Never
  rely on the page gate.

## Acceptance criteria

1. `npm run lint && npm run typecheck && npm run build && npm run test` pass.
2. As `admin@rype.local`: create user `test@rype.local` / password ≥ 8 chars / role staff
   → card appears without a manual reload; sign out, sign in as `test@rype.local` →
   lands on `/admin`, and visiting `/admin/inventory` redirects to `/admin?denied=1`
   (staff gate).
3. Creating a second user with email `TEST@rype.local ` (case/space variant) fails with
   the duplicate-email message (proves normalization).
4. The admin's own card has disabled role/delete controls; attempting
   `setUserRoleAction`/`deleteUserAction` against your own id via the action directly
   returns the self-change error.
5. With exactly one admin in the DB, demoting or deleting that admin returns the
   last-admin error and the row is unchanged.
6. Signed in as staff, invoking `createUserAction` returns `{ ok: false, error: "Admin
   only" }` (verify via a unit test with mocked `auth`, following the recipe in
   PLAN-server-action-tests.md).
7. View the page source / RSC payload of `/admin/users`: no `passwordHash` (or `$2a$`
   / `$2b$` bcrypt prefix) appears anywhere in the response.
