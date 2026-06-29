# Marketing Agency ERP

Production-capable ERP web app for a marketing agency. The app supports Kakao login, role-based dashboards, scoped admin access, client work management, calendar and leave management, manual billing/payment status, expense records with bank/card-ready sync fields, reports, and integration settings.

## Local Setup

1. Copy `.env.example` to `.env.local`.
2. Set `DATABASE_URL` for PostgreSQL.
3. Set `AUTH_SECRET`.
4. Add Kakao OAuth credentials when available.
5. Run `pnpm install`.
6. Run `pnpm prisma:generate`.
7. Run `pnpm prisma:migrate`.
8. Run `pnpm prisma:seed`.
9. Run `pnpm dev`.

## Verification

```bash
pnpm test
pnpm build
ALLOW_DEV_SESSION=true pnpm test:e2e
```

Playwright is configured to use the installed Chrome browser. If Chrome is not available on the machine, install Playwright browsers with `pnpm exec playwright install`.

## WordPress Integration

Keep WordPress as the public homepage. Deploy the ERP as a separate app on a subdomain, for example `https://erp.company.com`, and add a WordPress menu item or button linking to `https://erp.company.com/login`.

Do not embed the ERP directly inside a WordPress page by iframe for production use. Keeping it separate avoids plugin conflicts, session/cookie issues, and accidental exposure of admin-only routes.

## Version 1 Integration Boundaries

- Kakao OAuth login is in scope.
- PG payment is represented by billing and payment-ready records, but live PG calls are deferred.
- Bank and card expense sync is represented by financial-account records, but live sync is deferred.
- Google and Naver calendar live sync may be added after the internal calendar is stable.
- Blog/account performance metrics can be recorded in reports now; automated crawler/API collection can be added later.

## Production Notes

- Use PostgreSQL with automated backups.
- Set `ALLOW_DEV_SESSION=false` or omit it in production.
- Rotate `AUTH_SECRET` through deployment secrets, not source control.
- Restrict `/settings` to 최고관리자 accounts.
- Run Prisma migrations before promoting a release.
