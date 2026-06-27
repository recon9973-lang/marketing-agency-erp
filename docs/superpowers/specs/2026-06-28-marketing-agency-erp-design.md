# Marketing Agency ERP Design

## Purpose

Build an operations-ready ERP web app for a marketing agency. The system supports role-based dashboards, client work management, staff scheduling, settlement tracking, leave management, reports, and external account integrations.

The ERP runs separately from the company WordPress homepage. WordPress remains the public website, and the ERP is deployed on a subdomain such as `erp.company.com`.

## Scope

### Version 1

- Production-capable web app with real database, authentication, authorization, and audit logs.
- Kakao OAuth login for staff.
- Role-specific dashboards for super admins, admins, and marketers.
- Client, staff, assignment, work, calendar, billing, expense, leave, report, and account-management modules.
- Internal calendar with Google and Naver calendar integration-ready structure.
- Client billing and payment-status management without live PG integration.
- Company expense tracking with bank-account and card integration-ready structure.
- WordPress link integration through a login button or menu link to the ERP subdomain.

### Later Versions

- Live PG integration for client card, account-transfer, or virtual-account payments.
- Live bank-account and corporate-card transaction sync for expense reconciliation.
- Deeper Google and Naver calendar two-way sync.
- Automated collection of blog visitor counts, ranking data, and campaign performance metrics.
- More advanced report generation and delivery automation.

## Architecture

Use a full-stack Next.js application.

- Web app: Next.js.
- Database: PostgreSQL.
- ORM: Prisma.
- Authentication: Kakao OAuth through an auth layer such as Auth.js or equivalent.
- Authorization: server-side role and access-scope checks.
- Deployment: production web hosting with separate database service.
- WordPress integration: ERP is hosted separately on `erp.company.com`; WordPress links to ERP login.

The ERP should not be implemented as a WordPress plugin. Keeping it separate reduces security, update, and performance risks.

## Roles And Permissions

### Super Admin

The super admin has full access to all staff, admins, marketers, clients, schedules, tasks, billing, expenses, reports, leave records, integrations, and settings.

The super admin can:

- Assign clients to marketers.
- Assign admins to specific marketers and clients.
- Grant an admin company-wide access when the super admin selects that scope.
- View company-wide dashboards.
- Manage billing, payment status, expenses, leave policies, and integration settings.
- Issue instructions and monitor progress.

### Admin

An admin can only access marketers and clients assigned by the super admin. The assigned range may be partial or company-wide.

The admin can:

- View assigned clients and assigned marketers.
- Review work progress and delayed tasks.
- Manage instructions within the assigned scope.
- Review reports and leave requests if granted.
- View billing and expense summaries only for allowed clients or operational scope.

### Marketer

A marketer can only access their own work, schedule, assigned clients, client account data, and report materials.

The marketer can:

- View today’s tasks and calendar.
- Manage assigned client work.
- Enter progress notes and work results.
- Upload or record report data.
- Request leave and view their leave balance.

## Core Data Model

Key entities:

- User: staff member, role, status, Kakao account identity, calendar connection state.
- AccessScope: admin-to-marketer and admin-to-client visibility rules.
- Client: business information, contract information, active status, assigned marketer.
- ClientAccount: blog, SNS, place, receipt-review, and other platform account credentials or references.
- WorkItem: task for a client, category, owner, due date, status, priority, notes.
- WorkTemplate: repeatable work definitions such as brand blog writing, blog distribution, blog SEO exposure, receipt reviews, place ranking, SNS management, account management, and monthly reports.
- CalendarEvent: internal schedule, linked work item, linked external calendar metadata.
- BillingRecord: client, billing month, contracted amount, issued amount, paid amount, status, due date.
- PaymentRecord: manual payment record for version 1, PG-ready fields for future integration.
- ExpenseRecord: company spending record, vendor, category, amount, payment method, linked bank or card account, status.
- FinancialAccount: company bank account or card account metadata, connection state, and future sync configuration.
- LeavePolicy: annual leave rules and staff balances.
- LeaveRequest: requested dates, type, status, approver, approval history.
- Report: monthly client report, performance data, attachments, review state.
- AuditLog: actor, action, target, before/after summary, timestamp.

## Dashboards

Dashboards share the same data model but render different views by role.

### Super Admin Dashboard

Shows:

- Company-wide task progress.
- Full calendar and upcoming deadlines.
- Marketer workload.
- Client progress and risk status.
- Billing totals, unpaid amounts, overdue clients.
- Expense totals by month, account, card, and category.
- Leave status and pending approvals.
- Instructions and bottlenecks.

### Admin Dashboard

Shows:

- Assigned marketers and assigned clients only.
- Work progress and delayed tasks in scope.
- Review-needed reports.
- Calendar conflicts and upcoming deadlines.
- Leave approvals and operational alerts if permitted.
- Billing and expense summaries only where allowed.

### Marketer Dashboard

Shows:

- Today’s tasks.
- Internal calendar plus external calendar connection state.
- Assigned client checklist.
- Client work status by category.
- Progress notes, report materials, and upcoming deadlines.
- Leave balance and request status.

## Work Management

Supported work categories:

- Brand blog writing.
- Blog distribution.
- Blog SEO exposure.
- Receipt reviews.
- Place ranking management.
- SNS management and distribution.
- Client account management.
- Monthly report writing.
- Blog visitor and performance data collection.

Each work item includes:

- Client.
- Owner.
- Category.
- Status: not started, in progress, waiting, review needed, completed, blocked.
- Due date.
- Priority.
- Progress notes.
- Attachments or report references.

## Calendar

Version 1 includes an internal calendar. Google and Naver calendar connection records are part of the model so OAuth integration can be added cleanly.

Calendar events can be linked to:

- Work items.
- Client meetings.
- Report deadlines.
- Leave requests.
- Internal instructions.

External sync failures must not delete internal ERP events. Failed sync attempts are logged and can be retried.

## Billing, Payment, And Expense Management

### Client Billing And Payment Status

Version 1 manages billing and payment status without live PG integration.

Supported states:

- Draft.
- Issued.
- Unpaid.
- Partially paid.
- Paid.
- Overdue.
- Canceled.

The super admin can view total billed amount, paid amount, unpaid amount, overdue clients, and client-level payment history.

PG integration is deferred to a later version, but the data model includes future-ready payment identifiers, provider fields, webhook status fields, and reconciliation fields.

### Company Expenses

The finance module also tracks company expenses.

Version 1 supports:

- Manual expense entry.
- Expense categories.
- Vendor and memo fields.
- Payment method: bank account, corporate card, cash, or other.
- Linked financial account or card record.
- Review status: unreviewed, reviewed, excluded, or needs follow-up.
- Monthly expense summaries by category, account, and card.

Live bank-account and corporate-card sync is deferred to a later version. Version 1 stores account and card metadata so future API sync can be added without changing the core workflow.
Multi-step expense approval lines are out of scope for version 1.

## Leave Management

The system supports:

- Annual leave balance.
- Full-day leave.
- Half-day leave.
- Other leave types.
- Leave request.
- Approval, rejection, cancellation.
- Calendar reflection.
- Dashboard visibility by role.

Leave state changes are logged.

## Reports And Performance Data

The report module supports monthly client reporting.

Version 1 supports:

- Manual entry of blog visitors, rankings, distribution counts, review counts, SNS metrics, and notes.
- Attachments.
- Report status: draft, review needed, approved, delivered.
- Role-based review.

Automated crawling or API-based collection is a later-version feature.

## External Integrations

### Version 1

- Kakao OAuth login.
- Integration-ready structures for Google Calendar, Naver Calendar, PG, bank accounts, and corporate cards.

### Later Versions

- Google Calendar OAuth and sync.
- Naver Calendar OAuth and sync.
- PG payment creation and webhook sync.
- Bank-account and card transaction sync.
- Blog and marketing platform performance collection.

## Error Handling

- Unauthorized data access is blocked on the server.
- OAuth failures preserve the existing user account and show reconnection guidance.
- Calendar sync failures preserve internal events and create retryable logs.
- Billing and expense status changes write history records.
- Reversing a payment status requires a reason.
- Leave approval state changes follow allowed transitions only.
- Sensitive client account data is only visible to authorized users.

## Testing Strategy

Minimum test coverage:

- Role-based route and data access.
- Admin access-scope filtering.
- Client assignment.
- Work creation and status changes.
- Calendar event creation and linked task behavior.
- Billing status calculations.
- Expense summary calculations.
- Leave balance and approval flows.
- Dashboard aggregation by role.
- OAuth failure and reconnection states.
- Audit-log creation for key changes.

## Implementation Planning Inputs

- Exact hosting provider.
- Exact Kakao OAuth setup values.
- Whether Google and Naver calendar live sync are required in the first deploy or only represented as connection-ready settings.
- File storage provider for attachments and reports.
