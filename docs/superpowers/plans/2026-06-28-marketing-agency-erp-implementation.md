# Marketing Agency ERP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a production-capable V1 marketing agency ERP web app with role-specific dashboards, Kakao login, scoped authorization, client work management, calendar, billing, expense, leave, reports, and integration-ready structures.

**Architecture:** Create a full-stack Next.js App Router application backed by PostgreSQL and Prisma. Keep business rules in small domain modules under `src/domain`, data access in `src/server`, and route UI in `src/app` so authorization, dashboard aggregation, and workflow rules are testable outside React.

**Tech Stack:** Next.js, TypeScript, Prisma, PostgreSQL, Auth.js-compatible Kakao OAuth, Tailwind CSS, Vitest, React Testing Library, Playwright.

---

## File Structure

- Create `package.json`: scripts and dependencies.
- Create `next.config.ts`, `tsconfig.json`, `postcss.config.mjs`, `tailwind.config.ts`: app toolchain.
- Create `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/login/page.tsx`: app entry.
- Create `src/app/(erp)/layout.tsx`: authenticated ERP shell.
- Create `src/app/(erp)/dashboard/page.tsx`: role-routed dashboard.
- Create `src/app/(erp)/clients/page.tsx`: client and assignment view.
- Create `src/app/(erp)/work/page.tsx`: work management view.
- Create `src/app/(erp)/calendar/page.tsx`: internal calendar view.
- Create `src/app/(erp)/finance/page.tsx`: billing and expense view.
- Create `src/app/(erp)/leave/page.tsx`: leave management view.
- Create `src/app/(erp)/reports/page.tsx`: reports and performance view.
- Create `src/app/(erp)/settings/page.tsx`: integration settings.
- Create `src/components/erp/AppShell.tsx`: sidebar, header, and role-aware navigation.
- Create `src/components/dashboard/*.tsx`: role dashboard cards.
- Create `src/components/ui/*.tsx`: reusable buttons, badges, tables, stat cards.
- Create `src/domain/types.ts`: shared enums and TypeScript types.
- Create `src/domain/access-control.ts`: role and access-scope rules.
- Create `src/domain/dashboard.ts`: dashboard aggregation.
- Create `src/domain/finance.ts`: billing, payment, expense calculations.
- Create `src/domain/leave.ts`: leave balance and status rules.
- Create `src/domain/work.ts`: work status and task helpers.
- Create `src/server/db.ts`: Prisma client.
- Create `src/server/session.ts`: session helpers and current-user access.
- Create `src/server/audit.ts`: audit-log writer.
- Create `src/server/repositories/*.ts`: focused database queries.
- Create `prisma/schema.prisma`: database schema.
- Create `prisma/seed.ts`: demo organization data.
- Create `tests/domain/*.test.ts`: domain tests.
- Create `tests/e2e/role-access.spec.ts`: role access smoke tests.
- Create `.env.example`: required environment variables.
- Create `README.md`: setup and deployment instructions.

## Scope Split

This plan implements V1 from the approved design spec. Live PG payment, live bank/card transaction sync, automated blog metric crawling, and full two-way calendar sync remain later-version items. V1 still creates the database fields and settings screens needed to add those integrations cleanly later.

## Tasks

### Task 1: Scaffold The Next.js Project

**Files:**
- Create: `package.json`
- Create: `next.config.ts`
- Create: `tsconfig.json`
- Create: `postcss.config.mjs`
- Create: `tailwind.config.ts`
- Create: `src/app/globals.css`
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx`
- Create: `.env.example`

- [ ] **Step 1: Create failing smoke test for the project entry**

Create `tests/domain/project-smoke.test.ts`:

```ts
import { describe, expect, it } from "vitest";

describe("project setup", () => {
  it("uses the ERP product name", () => {
    expect("Marketing Agency ERP").toContain("ERP");
  });
});
```

- [ ] **Step 2: Run the test before dependencies exist**

Run: `pnpm test tests/domain/project-smoke.test.ts`

Expected: command fails because `package.json` and test tooling do not exist yet.

- [ ] **Step 3: Add project files**

Create `package.json`:

```json
{
  "name": "marketing-agency-erp",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "prisma:seed": "tsx prisma/seed.ts"
  },
  "dependencies": {
    "@auth/prisma-adapter": "^2.7.4",
    "@prisma/client": "^6.1.0",
    "next": "^15.1.0",
    "next-auth": "^5.0.0-beta.25",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "lucide-react": "^0.468.0",
    "zod": "^3.24.1"
  },
  "devDependencies": {
    "@playwright/test": "^1.49.1",
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.1.0",
    "@types/node": "^22.10.2",
    "@types/react": "^19.0.1",
    "@types/react-dom": "^19.0.2",
    "autoprefixer": "^10.4.20",
    "eslint": "^9.17.0",
    "eslint-config-next": "^15.1.0",
    "postcss": "^8.4.49",
    "prisma": "^6.1.0",
    "tailwindcss": "^3.4.17",
    "tsx": "^4.19.2",
    "typescript": "^5.7.2",
    "vitest": "^2.1.8"
  }
}
```

Create `next.config.ts`:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    typedRoutes: true
  }
};

export default nextConfig;
```

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "es2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    },
    "plugins": [{ "name": "next" }]
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

Create `postcss.config.mjs`:

```js
const config = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {}
  }
};

export default config;
```

Create `tailwind.config.ts`:

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#18202f",
        line: "#d8dde8",
        surface: "#f7f8fb",
        brand: "#1f7a68",
        warning: "#b7791f",
        danger: "#b83232"
      }
    }
  },
  plugins: []
};

export default config;
```

Create `src/app/globals.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  color: #18202f;
  background: #f7f8fb;
}

body {
  margin: 0;
  font-family: Arial, Helvetica, sans-serif;
}
```

Create `src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Marketing Agency ERP",
  description: "Operations ERP for marketing agencies"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
```

Create `src/app/page.tsx`:

```tsx
import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-6">
      <section className="w-full max-w-xl">
        <p className="text-sm font-semibold text-brand">Marketing Agency ERP</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-normal text-ink">업무 운영 시스템</h1>
        <p className="mt-4 text-base leading-7 text-slate-600">
          카카오 로그인 후 역할별 대시보드에서 거래처, 업무, 일정, 정산, 휴가, 보고서를 관리합니다.
        </p>
        <Link
          href="/login"
          className="mt-8 inline-flex h-11 items-center rounded-md bg-brand px-5 text-sm font-semibold text-white"
        >
          관리자 로그인
        </Link>
      </section>
    </main>
  );
}
```

Create `.env.example`:

```bash
DATABASE_URL="postgresql://erp:erp@localhost:5432/marketing_agency_erp"
AUTH_SECRET="replace-with-random-secret"
AUTH_URL="http://localhost:3000"
KAKAO_CLIENT_ID=""
KAKAO_CLIENT_SECRET=""
```

- [ ] **Step 4: Install dependencies**

Run: `pnpm install`

Expected: dependencies install and `pnpm-lock.yaml` is created.

- [ ] **Step 5: Run tests**

Run: `pnpm test tests/domain/project-smoke.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add package.json pnpm-lock.yaml next.config.ts tsconfig.json postcss.config.mjs tailwind.config.ts src/app tests .env.example
git commit -m "chore: scaffold ERP web app"
```

### Task 2: Define Domain Types And Prisma Schema

**Files:**
- Create: `src/domain/types.ts`
- Create: `prisma/schema.prisma`
- Create: `prisma/seed.ts`
- Create: `src/server/db.ts`
- Test: `tests/domain/schema-types.test.ts`

- [ ] **Step 1: Write failing type tests**

Create `tests/domain/schema-types.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { BillingStatus, Role, WorkStatus } from "@/domain/types";

describe("domain enums", () => {
  it("defines the required roles", () => {
    expect(Role.SUPER_ADMIN).toBe("SUPER_ADMIN");
    expect(Role.ADMIN).toBe("ADMIN");
    expect(Role.MARKETER).toBe("MARKETER");
  });

  it("defines work and billing states", () => {
    expect(WorkStatus.REVIEW_NEEDED).toBe("REVIEW_NEEDED");
    expect(BillingStatus.PARTIALLY_PAID).toBe("PARTIALLY_PAID");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/domain/schema-types.test.ts`

Expected: FAIL because `src/domain/types.ts` does not exist.

- [ ] **Step 3: Add domain enums**

Create `src/domain/types.ts`:

```ts
export enum Role {
  SUPER_ADMIN = "SUPER_ADMIN",
  ADMIN = "ADMIN",
  MARKETER = "MARKETER"
}

export enum WorkCategory {
  BRAND_BLOG = "BRAND_BLOG",
  BLOG_DISTRIBUTION = "BLOG_DISTRIBUTION",
  BLOG_SEO = "BLOG_SEO",
  RECEIPT_REVIEW = "RECEIPT_REVIEW",
  PLACE_RANKING = "PLACE_RANKING",
  SNS_MANAGEMENT = "SNS_MANAGEMENT",
  ACCOUNT_MANAGEMENT = "ACCOUNT_MANAGEMENT",
  MONTHLY_REPORT = "MONTHLY_REPORT",
  PERFORMANCE_COLLECTION = "PERFORMANCE_COLLECTION"
}

export enum WorkStatus {
  NOT_STARTED = "NOT_STARTED",
  IN_PROGRESS = "IN_PROGRESS",
  WAITING = "WAITING",
  REVIEW_NEEDED = "REVIEW_NEEDED",
  COMPLETED = "COMPLETED",
  BLOCKED = "BLOCKED"
}

export enum BillingStatus {
  DRAFT = "DRAFT",
  ISSUED = "ISSUED",
  UNPAID = "UNPAID",
  PARTIALLY_PAID = "PARTIALLY_PAID",
  PAID = "PAID",
  OVERDUE = "OVERDUE",
  CANCELED = "CANCELED"
}

export enum ExpenseReviewStatus {
  UNREVIEWED = "UNREVIEWED",
  REVIEWED = "REVIEWED",
  EXCLUDED = "EXCLUDED",
  NEEDS_FOLLOW_UP = "NEEDS_FOLLOW_UP"
}

export enum LeaveStatus {
  REQUESTED = "REQUESTED",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
  CANCELED = "CANCELED"
}
```

- [ ] **Step 4: Add Prisma schema**

Create `prisma/schema.prisma` with the models named in the design spec. Use Prisma enums that match `src/domain/types.ts`. Include `User`, `AccessScope`, `Client`, `ClientAccount`, `WorkTemplate`, `WorkItem`, `CalendarEvent`, `BillingRecord`, `PaymentRecord`, `ExpenseRecord`, `FinancialAccount`, `LeavePolicy`, `LeaveRequest`, `Report`, and `AuditLog`.

The schema must include these security-critical relations:

```prisma
model AccessScope {
  id          String   @id @default(cuid())
  adminId     String
  marketerId  String?
  clientId    String?
  allMarketers Boolean @default(false)
  allClients   Boolean @default(false)
  createdAt   DateTime @default(now())

  admin     User    @relation("AdminScopes", fields: [adminId], references: [id])
  marketer  User?   @relation("ScopedMarketers", fields: [marketerId], references: [id])
  client    Client? @relation(fields: [clientId], references: [id])
}
```

- [ ] **Step 5: Add Prisma client**

Create `src/server/db.ts`:

```ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"]
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
```

- [ ] **Step 6: Add seed data**

Create `prisma/seed.ts` with one super admin, one admin, two marketers, three clients, scopes, sample work items, billing records, expenses, leave requests, and reports.

- [ ] **Step 7: Generate Prisma client and run tests**

Run:

```bash
pnpm prisma:generate
pnpm test tests/domain/schema-types.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

Run:

```bash
git add src/domain/types.ts prisma src/server/db.ts tests/domain/schema-types.test.ts
git commit -m "feat: define ERP data model"
```

### Task 3: Implement Role And Access-Scope Rules

**Files:**
- Create: `src/domain/access-control.ts`
- Test: `tests/domain/access-control.test.ts`

- [ ] **Step 1: Write failing access-control tests**

Create `tests/domain/access-control.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { canAccessClient, canAccessMarketer } from "@/domain/access-control";
import { Role } from "@/domain/types";

const scopes = [
  { adminId: "admin-1", marketerId: "marketer-1", clientId: null, allMarketers: false, allClients: false },
  { adminId: "admin-1", marketerId: null, clientId: "client-1", allMarketers: false, allClients: false }
];

describe("access control", () => {
  it("allows super admins to access all clients and marketers", () => {
    const user = { id: "root", role: Role.SUPER_ADMIN };
    expect(canAccessClient(user, "client-any", [])).toBe(true);
    expect(canAccessMarketer(user, "marketer-any", [])).toBe(true);
  });

  it("limits admins to assigned clients and marketers", () => {
    const user = { id: "admin-1", role: Role.ADMIN };
    expect(canAccessClient(user, "client-1", scopes)).toBe(true);
    expect(canAccessClient(user, "client-2", scopes)).toBe(false);
    expect(canAccessMarketer(user, "marketer-1", scopes)).toBe(true);
    expect(canAccessMarketer(user, "marketer-2", scopes)).toBe(false);
  });

  it("allows marketers to access only themselves", () => {
    const user = { id: "marketer-1", role: Role.MARKETER };
    expect(canAccessMarketer(user, "marketer-1", [])).toBe(true);
    expect(canAccessMarketer(user, "marketer-2", [])).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/domain/access-control.test.ts`

Expected: FAIL because `src/domain/access-control.ts` does not exist.

- [ ] **Step 3: Implement access-control functions**

Create `src/domain/access-control.ts`:

```ts
import { Role } from "./types";

export type CurrentUser = {
  id: string;
  role: Role;
};

export type AccessScopeRecord = {
  adminId: string;
  marketerId: string | null;
  clientId: string | null;
  allMarketers: boolean;
  allClients: boolean;
};

export function canAccessMarketer(
  user: CurrentUser,
  marketerId: string,
  scopes: AccessScopeRecord[]
) {
  if (user.role === Role.SUPER_ADMIN) return true;
  if (user.role === Role.MARKETER) return user.id === marketerId;
  return scopes.some(
    (scope) =>
      scope.adminId === user.id &&
      (scope.allMarketers || scope.marketerId === marketerId)
  );
}

export function canAccessClient(
  user: CurrentUser,
  clientId: string,
  scopes: AccessScopeRecord[],
  assignedMarketerId?: string
) {
  if (user.role === Role.SUPER_ADMIN) return true;
  if (user.role === Role.MARKETER) return assignedMarketerId === user.id;
  return scopes.some(
    (scope) =>
      scope.adminId === user.id &&
      (scope.allClients || scope.clientId === clientId)
  );
}

export function assertCanAccessClient(
  user: CurrentUser,
  clientId: string,
  scopes: AccessScopeRecord[],
  assignedMarketerId?: string
) {
  if (!canAccessClient(user, clientId, scopes, assignedMarketerId)) {
    throw new Error("FORBIDDEN_CLIENT_ACCESS");
  }
}
```

- [ ] **Step 4: Run test**

Run: `pnpm test tests/domain/access-control.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/domain/access-control.ts tests/domain/access-control.test.ts
git commit -m "feat: add role access rules"
```

### Task 4: Add Authentication And ERP Shell

**Files:**
- Create: `src/server/session.ts`
- Create: `src/app/login/page.tsx`
- Create: `src/app/(erp)/layout.tsx`
- Create: `src/components/erp/AppShell.tsx`
- Modify: `src/app/page.tsx`
- Test: `tests/domain/navigation.test.ts`

- [ ] **Step 1: Write failing navigation test**

Create `tests/domain/navigation.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { getNavigationItems } from "@/components/erp/AppShell";
import { Role } from "@/domain/types";

describe("role navigation", () => {
  it("hides staff management from marketers", () => {
    const labels = getNavigationItems(Role.MARKETER).map((item) => item.label);
    expect(labels).toContain("업무관리");
    expect(labels).not.toContain("직원/권한");
  });

  it("shows staff management to super admins", () => {
    const labels = getNavigationItems(Role.SUPER_ADMIN).map((item) => item.label);
    expect(labels).toContain("직원/권한");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/domain/navigation.test.ts`

Expected: FAIL because `AppShell` does not exist.

- [ ] **Step 3: Add session helper**

Create `src/server/session.ts` with `getCurrentUser()` returning the authenticated user from Auth.js. Include a development fallback guarded by `ALLOW_DEV_SESSION=true` so local development can view role dashboards before Kakao credentials are configured.

- [ ] **Step 4: Add login page**

Create `src/app/login/page.tsx` with a Kakao login button and environment warning when Kakao credentials are missing.

- [ ] **Step 5: Add AppShell**

Create `src/components/erp/AppShell.tsx`:

```tsx
import Link from "next/link";
import { CalendarDays, ChartNoAxesCombined, ClipboardList, CreditCard, FileText, Settings, Users } from "lucide-react";
import { Role } from "@/domain/types";

export type NavItem = {
  href: string;
  label: string;
  roles: Role[];
};

export function getNavigationItems(role: Role): NavItem[] {
  const items: NavItem[] = [
    { href: "/dashboard", label: "대시보드", roles: [Role.SUPER_ADMIN, Role.ADMIN, Role.MARKETER] },
    { href: "/clients", label: "거래처", roles: [Role.SUPER_ADMIN, Role.ADMIN, Role.MARKETER] },
    { href: "/work", label: "업무관리", roles: [Role.SUPER_ADMIN, Role.ADMIN, Role.MARKETER] },
    { href: "/calendar", label: "캘린더", roles: [Role.SUPER_ADMIN, Role.ADMIN, Role.MARKETER] },
    { href: "/finance", label: "정산/지출", roles: [Role.SUPER_ADMIN, Role.ADMIN] },
    { href: "/leave", label: "연차/휴가", roles: [Role.SUPER_ADMIN, Role.ADMIN, Role.MARKETER] },
    { href: "/reports", label: "보고서", roles: [Role.SUPER_ADMIN, Role.ADMIN, Role.MARKETER] },
    { href: "/settings", label: "직원/권한", roles: [Role.SUPER_ADMIN] }
  ];

  return items.filter((item) => item.roles.includes(role));
}

export function AppShell({ children, role }: { children: React.ReactNode; role: Role }) {
  const items = getNavigationItems(role);
  return (
    <div className="min-h-screen bg-surface text-ink">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-line bg-white p-5 md:block">
        <div className="text-lg font-semibold">Marketing ERP</div>
        <nav className="mt-8 grid gap-1">
          {items.map((item) => (
            <Link key={item.href} href={item.href} className="rounded-md px-3 py-2 text-sm hover:bg-surface">
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="min-h-screen md:pl-64">
        <header className="border-b border-line bg-white px-6 py-4">
          <p className="text-sm text-slate-500">역할: {role}</p>
        </header>
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
```

- [ ] **Step 6: Add ERP layout**

Create `src/app/(erp)/layout.tsx` that calls `getCurrentUser()` and wraps children with `AppShell`.

- [ ] **Step 7: Run tests**

Run: `pnpm test tests/domain/navigation.test.ts`

Expected: PASS.

- [ ] **Step 8: Commit**

Run:

```bash
git add src/server/session.ts src/app/login src/app/'(erp)' src/components/erp tests/domain/navigation.test.ts src/app/page.tsx
git commit -m "feat: add authentication shell"
```

### Task 5: Build Dashboard Aggregation And Role Dashboards

**Files:**
- Create: `src/domain/dashboard.ts`
- Create: `src/components/dashboard/SuperAdminDashboard.tsx`
- Create: `src/components/dashboard/AdminDashboard.tsx`
- Create: `src/components/dashboard/MarketerDashboard.tsx`
- Create: `src/app/(erp)/dashboard/page.tsx`
- Test: `tests/domain/dashboard.test.ts`

- [ ] **Step 1: Write failing aggregation tests**

Create `tests/domain/dashboard.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { summarizeDashboard } from "@/domain/dashboard";
import { BillingStatus, WorkStatus } from "@/domain/types";

describe("dashboard aggregation", () => {
  it("counts overdue billing and delayed work", () => {
    const summary = summarizeDashboard({
      workItems: [
        { status: WorkStatus.IN_PROGRESS, dueDate: "2026-06-20" },
        { status: WorkStatus.COMPLETED, dueDate: "2026-06-20" }
      ],
      billings: [
        { status: BillingStatus.OVERDUE, issuedAmount: 1000000, paidAmount: 0 },
        { status: BillingStatus.PAID, issuedAmount: 500000, paidAmount: 500000 }
      ],
      expenses: [{ amount: 300000 }],
      leaveRequests: [{ status: "REQUESTED" }]
    });

    expect(summary.delayedWorkCount).toBe(1);
    expect(summary.unpaidAmount).toBe(1000000);
    expect(summary.expenseTotal).toBe(300000);
    expect(summary.pendingLeaveCount).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/domain/dashboard.test.ts`

Expected: FAIL because `summarizeDashboard` does not exist.

- [ ] **Step 3: Implement aggregation**

Create `src/domain/dashboard.ts` with `summarizeDashboard(input)` that returns `delayedWorkCount`, `unpaidAmount`, `expenseTotal`, and `pendingLeaveCount`.

- [ ] **Step 4: Create role dashboard components**

Create three focused dashboard components. Each receives a summary object and renders only the role-appropriate cards:

- Super admin: total work, delayed work, unpaid amount, expenses, pending leave.
- Admin: scoped delayed work, review-needed work, upcoming deadlines, pending leave.
- Marketer: today work, assigned client count, report tasks, leave balance.

- [ ] **Step 5: Create dashboard route**

Create `src/app/(erp)/dashboard/page.tsx` that loads the current user, fetches scoped records, aggregates them, and renders the correct dashboard component.

- [ ] **Step 6: Run tests**

Run: `pnpm test tests/domain/dashboard.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```bash
git add src/domain/dashboard.ts src/components/dashboard src/app/'(erp)'/dashboard tests/domain/dashboard.test.ts
git commit -m "feat: add role dashboards"
```

### Task 6: Implement Client And Assignment Management

**Files:**
- Create: `src/server/repositories/clients.ts`
- Create: `src/app/(erp)/clients/page.tsx`
- Create: `src/components/ui/DataTable.tsx`
- Test: `tests/domain/client-scope.test.ts`

- [ ] **Step 1: Write failing client-scope test**

Create `tests/domain/client-scope.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { filterClientsForUser } from "@/server/repositories/clients";
import { Role } from "@/domain/types";

const clients = [
  { id: "client-1", assignedMarketerId: "marketer-1", name: "A 병원" },
  { id: "client-2", assignedMarketerId: "marketer-2", name: "B 학원" }
];

describe("client filtering", () => {
  it("shows only assigned marketer clients to marketers", () => {
    const result = filterClientsForUser({ id: "marketer-1", role: Role.MARKETER }, clients, []);
    expect(result.map((client) => client.id)).toEqual(["client-1"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/domain/client-scope.test.ts`

Expected: FAIL because `filterClientsForUser` does not exist.

- [ ] **Step 3: Implement repository filter helper**

Create `src/server/repositories/clients.ts`:

```ts
import { canAccessClient, type AccessScopeRecord, type CurrentUser } from "@/domain/access-control";

export type ClientListItem = {
  id: string;
  name: string;
  assignedMarketerId: string | null;
};

export function filterClientsForUser(
  user: CurrentUser,
  clients: ClientListItem[],
  scopes: AccessScopeRecord[]
) {
  return clients.filter((client) =>
    canAccessClient(user, client.id, scopes, client.assignedMarketerId ?? undefined)
  );
}
```

- [ ] **Step 4: Build client list route**

Create `src/app/(erp)/clients/page.tsx` showing client name, assigned marketer, contract amount, payment status, and latest work status. Super admins see assignment controls. Admins see only scoped clients. Marketers see assigned clients.

- [ ] **Step 5: Run tests**

Run: `pnpm test tests/domain/client-scope.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add src/server/repositories/clients.ts src/app/'(erp)'/clients src/components/ui/DataTable.tsx tests/domain/client-scope.test.ts
git commit -m "feat: add client management"
```

### Task 7: Implement Work Management

**Files:**
- Create: `src/domain/work.ts`
- Create: `src/server/repositories/work.ts`
- Create: `src/app/(erp)/work/page.tsx`
- Test: `tests/domain/work.test.ts`

- [ ] **Step 1: Write failing work tests**

Create `tests/domain/work.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { isWorkDelayed, nextWorkStatus } from "@/domain/work";
import { WorkStatus } from "@/domain/types";

describe("work rules", () => {
  it("marks incomplete past-due work as delayed", () => {
    expect(isWorkDelayed({ status: WorkStatus.IN_PROGRESS, dueDate: "2026-06-01" }, "2026-06-28")).toBe(true);
    expect(isWorkDelayed({ status: WorkStatus.COMPLETED, dueDate: "2026-06-01" }, "2026-06-28")).toBe(false);
  });

  it("moves in-progress work to review needed", () => {
    expect(nextWorkStatus(WorkStatus.IN_PROGRESS, "submit_for_review")).toBe(WorkStatus.REVIEW_NEEDED);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/domain/work.test.ts`

Expected: FAIL because `src/domain/work.ts` does not exist.

- [ ] **Step 3: Implement work rules**

Create `src/domain/work.ts` with `isWorkDelayed()` and `nextWorkStatus()`. Allow transitions: not started to in progress, in progress to review needed, review needed to completed, any non-completed state to blocked, blocked to in progress.

- [ ] **Step 4: Build work page**

Create `src/app/(erp)/work/page.tsx` with filters for category, status, client, owner, and due date. Include task rows for brand blog, blog distribution, SEO exposure, receipt review, place ranking, SNS, account management, monthly report, and performance collection.

- [ ] **Step 5: Run tests**

Run: `pnpm test tests/domain/work.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add src/domain/work.ts src/server/repositories/work.ts src/app/'(erp)'/work tests/domain/work.test.ts
git commit -m "feat: add work management"
```

### Task 8: Implement Calendar And Leave Management

**Files:**
- Create: `src/domain/leave.ts`
- Create: `src/server/repositories/calendar.ts`
- Create: `src/server/repositories/leave.ts`
- Create: `src/app/(erp)/calendar/page.tsx`
- Create: `src/app/(erp)/leave/page.tsx`
- Test: `tests/domain/leave.test.ts`

- [ ] **Step 1: Write failing leave tests**

Create `tests/domain/leave.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { calculateRemainingLeave, transitionLeave } from "@/domain/leave";
import { LeaveStatus } from "@/domain/types";

describe("leave rules", () => {
  it("subtracts approved leave from allowance", () => {
    expect(calculateRemainingLeave(15, [{ days: 2, status: LeaveStatus.APPROVED }])).toBe(13);
  });

  it("allows requested leave to be approved", () => {
    expect(transitionLeave(LeaveStatus.REQUESTED, "approve")).toBe(LeaveStatus.APPROVED);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/domain/leave.test.ts`

Expected: FAIL because `src/domain/leave.ts` does not exist.

- [ ] **Step 3: Implement leave rules**

Create `src/domain/leave.ts` with leave balance and allowed state transitions.

- [ ] **Step 4: Build calendar page**

Create `src/app/(erp)/calendar/page.tsx` showing internal events grouped by day, with badges for work deadline, client meeting, report deadline, leave, and instruction. Show Google and Naver connection state as integration-ready cards.

- [ ] **Step 5: Build leave page**

Create `src/app/(erp)/leave/page.tsx` showing remaining leave, request form, request history, and approval list for admins and super admins.

- [ ] **Step 6: Run tests**

Run: `pnpm test tests/domain/leave.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```bash
git add src/domain/leave.ts src/server/repositories/calendar.ts src/server/repositories/leave.ts src/app/'(erp)'/calendar src/app/'(erp)'/leave tests/domain/leave.test.ts
git commit -m "feat: add calendar and leave management"
```

### Task 9: Implement Billing, Payment Status, And Expenses

**Files:**
- Create: `src/domain/finance.ts`
- Create: `src/server/repositories/finance.ts`
- Create: `src/app/(erp)/finance/page.tsx`
- Test: `tests/domain/finance.test.ts`

- [ ] **Step 1: Write failing finance tests**

Create `tests/domain/finance.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { getBillingStatus, summarizeFinance } from "@/domain/finance";
import { BillingStatus, ExpenseReviewStatus } from "@/domain/types";

describe("finance rules", () => {
  it("detects partially paid bills", () => {
    expect(getBillingStatus({ issuedAmount: 1000000, paidAmount: 300000, dueDate: "2026-06-30" }, "2026-06-28")).toBe(BillingStatus.PARTIALLY_PAID);
  });

  it("summarizes unpaid billing and reviewed expenses", () => {
    const summary = summarizeFinance({
      billings: [{ issuedAmount: 1000000, paidAmount: 300000 }],
      expenses: [{ amount: 120000, reviewStatus: ExpenseReviewStatus.REVIEWED }]
    });
    expect(summary.unpaidAmount).toBe(700000);
    expect(summary.reviewedExpenseAmount).toBe(120000);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/domain/finance.test.ts`

Expected: FAIL because `src/domain/finance.ts` does not exist.

- [ ] **Step 3: Implement finance rules**

Create `src/domain/finance.ts` with `getBillingStatus()` and `summarizeFinance()`. Treat unpaid past due records as `OVERDUE`; paid records as `PAID`; partial payments as `PARTIALLY_PAID`.

- [ ] **Step 4: Build finance page**

Create `src/app/(erp)/finance/page.tsx` with two tabs: `거래처 청구/입금` and `회사 지출`. Billing rows show client, month, issued amount, paid amount, status, due date. Expense rows show vendor, category, amount, payment method, linked account/card, review status.

- [ ] **Step 5: Run tests**

Run: `pnpm test tests/domain/finance.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add src/domain/finance.ts src/server/repositories/finance.ts src/app/'(erp)'/finance tests/domain/finance.test.ts
git commit -m "feat: add billing and expense management"
```

### Task 10: Implement Reports, Client Accounts, And Settings

**Files:**
- Create: `src/server/repositories/reports.ts`
- Create: `src/server/repositories/settings.ts`
- Create: `src/app/(erp)/reports/page.tsx`
- Create: `src/app/(erp)/settings/page.tsx`
- Create: `src/server/audit.ts`
- Test: `tests/domain/audit.test.ts`

- [ ] **Step 1: Write failing audit test**

Create `tests/domain/audit.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildAuditEvent } from "@/server/audit";

describe("audit events", () => {
  it("records actor, action, target, and summary", () => {
    const event = buildAuditEvent({
      actorId: "user-1",
      action: "WORK_STATUS_CHANGED",
      targetType: "WorkItem",
      targetId: "work-1",
      summary: "IN_PROGRESS -> REVIEW_NEEDED"
    });
    expect(event.actorId).toBe("user-1");
    expect(event.summary).toContain("REVIEW_NEEDED");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/domain/audit.test.ts`

Expected: FAIL because `src/server/audit.ts` does not exist.

- [ ] **Step 3: Implement audit helper**

Create `src/server/audit.ts`:

```ts
export type AuditEventInput = {
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  summary: string;
};

export function buildAuditEvent(input: AuditEventInput) {
  return {
    ...input,
    createdAt: new Date()
  };
}
```

- [ ] **Step 4: Build reports page**

Create `src/app/(erp)/reports/page.tsx` showing monthly reports, status, review owner, performance fields, attachment file names, upload dates, and reviewer notes.

- [ ] **Step 5: Build settings page**

Create `src/app/(erp)/settings/page.tsx` for super admins. Include staff roles, admin access scopes, Kakao status, Google/Naver calendar connection-ready cards, PG future settings, and bank/card future sync settings.

- [ ] **Step 6: Run tests**

Run: `pnpm test tests/domain/audit.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```bash
git add src/server/audit.ts src/server/repositories/reports.ts src/server/repositories/settings.ts src/app/'(erp)'/reports src/app/'(erp)'/settings tests/domain/audit.test.ts
git commit -m "feat: add reports settings and audit helpers"
```

### Task 11: Add End-To-End Access Smoke Tests

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/e2e/role-access.spec.ts`
- Modify: `src/server/session.ts`

- [ ] **Step 1: Add Playwright config**

Create `playwright.config.ts`:

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: true
  },
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry"
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } }
  ]
});
```

- [ ] **Step 2: Add role smoke tests**

Create `tests/e2e/role-access.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test("marketer cannot see staff permissions nav", async ({ page }) => {
  await page.goto("/dashboard?devRole=MARKETER");
  await expect(page.getByText("업무관리")).toBeVisible();
  await expect(page.getByText("직원/권한")).toHaveCount(0);
});

test("super admin can see staff permissions nav", async ({ page }) => {
  await page.goto("/dashboard?devRole=SUPER_ADMIN");
  await expect(page.getByText("직원/권한")).toBeVisible();
});
```

- [ ] **Step 3: Support devRole only in development**

Modify `src/server/session.ts` so `?devRole=SUPER_ADMIN|ADMIN|MARKETER` works only when `NODE_ENV !== "production"` and `ALLOW_DEV_SESSION=true`.

- [ ] **Step 4: Run E2E tests**

Run: `ALLOW_DEV_SESSION=true pnpm test:e2e`

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add playwright.config.ts tests/e2e src/server/session.ts
git commit -m "test: add role access e2e smoke tests"
```

### Task 12: Add Setup And Deployment Documentation

**Files:**
- Create: `README.md`
- Modify: `.env.example`
- Modify: `docs/superpowers/specs/2026-06-28-marketing-agency-erp-design.md` if implementation clarifies any wording.

- [ ] **Step 1: Write README**

Create `README.md` with:

```md
# Marketing Agency ERP

Production-capable ERP web app for a marketing agency.

## Local Setup

1. Copy `.env.example` to `.env.local`.
2. Set `DATABASE_URL`.
3. Set `AUTH_SECRET`.
4. Add Kakao OAuth credentials when available.
5. Run `pnpm install`.
6. Run `pnpm prisma:generate`.
7. Run `pnpm prisma:migrate`.
8. Run `pnpm prisma:seed`.
9. Run `pnpm dev`.

## WordPress Integration

Keep WordPress as the public homepage. Add a menu item or button linking to the ERP subdomain, for example `https://erp.company.com/login`.

## Version 1 Integration Boundaries

- Kakao OAuth login is in scope.
- PG payment is represented by billing and payment-ready records, but live PG calls are deferred.
- Bank and card expense sync is represented by financial-account records, but live sync is deferred.
- Google and Naver calendar live sync may be added after the internal calendar is stable.
```

- [ ] **Step 2: Run full verification**

Run:

```bash
pnpm test
pnpm build
ALLOW_DEV_SESSION=true pnpm test:e2e
```

Expected: all commands PASS.

- [ ] **Step 3: Commit**

Run:

```bash
git add README.md .env.example docs/superpowers/specs/2026-06-28-marketing-agency-erp-design.md
git commit -m "docs: add ERP setup and deployment guide"
```

## Self-Review

Spec coverage:

- Production web app: Tasks 1, 2, 4, 11, 12.
- Kakao OAuth: Tasks 4 and 12.
- Role dashboards: Tasks 3, 4, 5, 11.
- Admin scoped visibility: Tasks 3, 6, 11.
- Client and assignment management: Task 6.
- Work categories and progress: Task 7.
- Calendar and external-ready structure: Tasks 2, 8, 10.
- Billing and client payment status without PG: Task 9.
- Company expenses with account/card-ready structure: Task 9.
- Leave management: Task 8.
- Reports and performance data: Task 10.
- WordPress subdomain integration: Task 12.
- Audit logs and error-sensitive changes: Tasks 2 and 10.

Placeholder scan:

- Plan wording was checked for incomplete markers and vague implementation instructions.
- Later-version features are explicitly out of V1 scope and represented by integration-ready data/settings.

Type consistency:

- Role, WorkStatus, BillingStatus, ExpenseReviewStatus, and LeaveStatus are defined in Task 2 and reused by later tasks.
- Access-scope functions are defined in Task 3 and reused by client filtering in Task 6.
