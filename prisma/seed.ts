import {
  BillingStatus,
  CalendarEventKind,
  CalendarProvider,
  ClientAccountPlatform,
  ConnectionStatus,
  ExpenseReviewStatus,
  FinancialAccountType,
  LeaveStatus,
  LeaveType,
  PaymentMethod,
  PaymentProvider,
  PrismaClient,
  ReportStatus,
  Role,
  UserStatus,
  WorkCategory,
  WorkStatus
} from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.geoAnswerRecord.deleteMany();
  await prisma.geoQuestion.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.calendarEvent.deleteMany();
  await prisma.paymentRecord.deleteMany();
  await prisma.billingRecord.deleteMany();
  await prisma.expenseRecord.deleteMany();
  await prisma.report.deleteMany();
  await prisma.leaveRequest.deleteMany();
  await prisma.leavePolicy.deleteMany();
  await prisma.workItem.deleteMany();
  await prisma.workTemplate.deleteMany();
  await prisma.clientAccount.deleteMany();
  await prisma.accessScope.deleteMany();
  await prisma.client.deleteMany();
  await prisma.financialAccount.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();

  const [superAdmin, admin, marketerA, marketerB] = await Promise.all([
    prisma.user.create({
      data: {
        name: "Super Admin",
        email: "superadmin@example.com",
        role: Role.SUPER_ADMIN,
        status: UserStatus.ACTIVE,
        kakaoId: "kakao-super-admin"
      }
    }),
    prisma.user.create({
      data: {
        name: "Agency Admin",
        email: "admin@example.com",
        role: Role.ADMIN,
        status: UserStatus.ACTIVE,
        kakaoId: "kakao-admin"
      }
    }),
    prisma.user.create({
      data: {
        name: "Minji Kim",
        email: "minji@example.com",
        role: Role.MARKETER,
        status: UserStatus.ACTIVE,
        kakaoId: "kakao-minji"
      }
    }),
    prisma.user.create({
      data: {
        name: "Joon Park",
        email: "joon@example.com",
        role: Role.MARKETER,
        status: UserStatus.ACTIVE,
        kakaoId: "kakao-joon"
      }
    })
  ]);

  const [bankAccount, corporateCard] = await Promise.all([
    prisma.financialAccount.create({
      data: {
        type: FinancialAccountType.BANK,
        displayName: "Operating Account",
        institutionName: "Korea Bank",
        accountLast4: "1024",
        connectionStatus: ConnectionStatus.DISCONNECTED
      }
    }),
    prisma.financialAccount.create({
      data: {
        type: FinancialAccountType.CARD,
        displayName: "Corporate Card",
        institutionName: "Shinhan Card",
        cardLast4: "8899",
        connectionStatus: ConnectionStatus.ERROR,
        provider: "manual-import"
      }
    })
  ]);

  const [clientA, clientB, clientC] = await Promise.all([
    prisma.client.create({
      data: {
        name: "Seoul Dental Clinic",
        code: "CLIENT-SEOUL-DENTAL",
        contactName: "Dr. Han",
        contactEmail: "han@seouldental.example.com",
        monthlyContractFee: "1800000",
        contractStartDate: new Date("2026-01-01T00:00:00.000Z"),
        assignedMarketerId: marketerA.id
      }
    }),
    prisma.client.create({
      data: {
        name: "Busan Pilates Studio",
        code: "CLIENT-BUSAN-PILATES",
        contactName: "Sora Lee",
        contactEmail: "hello@busanpilates.example.com",
        monthlyContractFee: "1200000",
        contractStartDate: new Date("2026-02-01T00:00:00.000Z"),
        assignedMarketerId: marketerA.id
      }
    }),
    prisma.client.create({
      data: {
        name: "Daegu Legal Partners",
        code: "CLIENT-DAEGU-LEGAL",
        contactName: "Attorney Choi",
        contactEmail: "contact@daegulegal.example.com",
        monthlyContractFee: "2400000",
        contractStartDate: new Date("2026-03-01T00:00:00.000Z"),
        assignedMarketerId: marketerB.id
      }
    })
  ]);

  await prisma.accessScope.createMany({
    data: [
      {
        adminId: admin.id,
        marketerId: marketerA.id,
        allClients: false,
        allMarketers: false
      },
      {
        adminId: admin.id,
        clientId: clientA.id,
        allClients: false,
        allMarketers: false
      },
      {
        adminId: admin.id,
        clientId: clientB.id,
        allClients: false,
        allMarketers: false
      }
    ]
  });

  await prisma.clientAccount.createMany({
    data: [
      {
        clientId: clientA.id,
        managerId: marketerA.id,
        platform: ClientAccountPlatform.BLOG,
        label: "Naver Blog",
        handle: "seouldentalblog",
        isPrimary: true
      },
      {
        clientId: clientB.id,
        managerId: marketerA.id,
        platform: ClientAccountPlatform.SNS,
        label: "Instagram",
        handle: "@busanpilates"
      },
      {
        clientId: clientC.id,
        managerId: marketerB.id,
        platform: ClientAccountPlatform.PLACE,
        label: "Naver Place",
        handle: "daegulegal-place"
      }
    ]
  });

  const [monthlyReportTemplate, snsTemplate] = await Promise.all([
    prisma.workTemplate.create({
      data: {
        title: "Monthly Report Package",
        category: WorkCategory.MONTHLY_REPORT,
        description: "Collect performance data and draft the monthly client report.",
        defaultPriority: 4,
        estimatedHours: "3.50",
        cadenceDays: 30,
        createdById: superAdmin.id
      }
    }),
    prisma.workTemplate.create({
      data: {
        title: "SNS Weekly Management",
        category: WorkCategory.SNS_MANAGEMENT,
        description: "Prepare social posts and monitor engagement.",
        defaultPriority: 3,
        estimatedHours: "2.00",
        cadenceDays: 7,
        createdById: admin.id
      }
    })
  ]);

  const [workA, workB, workC] = await Promise.all([
    prisma.workItem.create({
      data: {
        clientId: clientA.id,
        ownerId: marketerA.id,
        createdById: admin.id,
        templateId: monthlyReportTemplate.id,
        title: "June monthly report draft",
        category: WorkCategory.MONTHLY_REPORT,
        status: WorkStatus.REVIEW_NEEDED,
        priority: 5,
        dueDate: new Date("2026-06-30T09:00:00.000Z"),
        progressNotes: "Traffic summary collected, waiting on final keyword ranking update."
      }
    }),
    prisma.workItem.create({
      data: {
        clientId: clientB.id,
        ownerId: marketerA.id,
        createdById: admin.id,
        templateId: snsTemplate.id,
        title: "Instagram content calendar",
        category: WorkCategory.SNS_MANAGEMENT,
        status: WorkStatus.IN_PROGRESS,
        priority: 3,
        dueDate: new Date("2026-07-02T03:00:00.000Z"),
        progressNotes: "Drafted three carousel posts."
      }
    }),
    prisma.workItem.create({
      data: {
        clientId: clientC.id,
        ownerId: marketerB.id,
        createdById: superAdmin.id,
        title: "Receipt review follow-up",
        category: WorkCategory.RECEIPT_REVIEW,
        status: WorkStatus.NOT_STARTED,
        priority: 2,
        dueDate: new Date("2026-07-05T03:00:00.000Z")
      }
    })
  ]);

  const billingA = await prisma.billingRecord.create({
    data: {
      clientId: clientA.id,
      issuedById: admin.id,
      billingMonth: new Date("2026-06-01T00:00:00.000Z"),
      contractAmount: "1800000",
      issuedAmount: "1800000",
      paidAmount: "900000",
      status: BillingStatus.PARTIALLY_PAID,
      invoiceNumber: "INV-2026-06-001",
      issuedAt: new Date("2026-06-01T00:00:00.000Z"),
      dueDate: new Date("2026-06-10T00:00:00.000Z"),
      pgProvider: PaymentProvider.MANUAL,
      reconciliationStatus: "PARTIAL"
    }
  });

  await prisma.paymentRecord.create({
    data: {
      billingRecordId: billingA.id,
      recordedById: admin.id,
      amount: "900000",
      method: PaymentMethod.BANK_TRANSFER,
      provider: PaymentProvider.MANUAL,
      receivedAt: new Date("2026-06-08T00:00:00.000Z"),
      reconciliationStatus: "MATCHED"
    }
  });

  await prisma.expenseRecord.createMany({
    data: [
      {
        clientId: clientA.id,
        submittedById: marketerA.id,
        reviewedById: admin.id,
        financialAccountId: corporateCard.id,
        category: "Ad Spend",
        vendor: "Meta Ads",
        amount: "450000",
        paymentMethod: PaymentMethod.CARD,
        reviewStatus: ExpenseReviewStatus.REVIEWED,
        paidAt: new Date("2026-06-12T00:00:00.000Z"),
        reviewedAt: new Date("2026-06-13T00:00:00.000Z")
      },
      {
        submittedById: marketerB.id,
        financialAccountId: bankAccount.id,
        category: "Travel",
        vendor: "KTX",
        amount: "78000",
        paymentMethod: PaymentMethod.BANK_TRANSFER,
        reviewStatus: ExpenseReviewStatus.NEEDS_FOLLOW_UP,
        paidAt: new Date("2026-06-15T00:00:00.000Z"),
        memo: "Client site visit"
      }
    ]
  });

  const leavePolicyA = await prisma.leavePolicy.create({
    data: {
      userId: marketerA.id,
      year: 2026,
      annualDays: "15",
      usedDays: "2"
    }
  });

  const leavePolicyB = await prisma.leavePolicy.create({
    data: {
      userId: marketerB.id,
      year: 2026,
      annualDays: "15",
      usedDays: "1"
    }
  });

  const approvedLeave = await prisma.leaveRequest.create({
    data: {
      requesterId: marketerA.id,
      approverId: admin.id,
      leavePolicyId: leavePolicyA.id,
      type: LeaveType.ANNUAL,
      status: LeaveStatus.APPROVED,
      startDate: new Date("2026-07-10T00:00:00.000Z"),
      endDate: new Date("2026-07-10T09:00:00.000Z"),
      daysRequested: "1",
      reviewedAt: new Date("2026-06-20T00:00:00.000Z"),
      reason: "Family appointment"
    }
  });

  await prisma.leaveRequest.create({
    data: {
      requesterId: marketerB.id,
      leavePolicyId: leavePolicyB.id,
      type: LeaveType.HALF_DAY_PM,
      status: LeaveStatus.REQUESTED,
      startDate: new Date("2026-07-17T04:00:00.000Z"),
      endDate: new Date("2026-07-17T09:00:00.000Z"),
      daysRequested: "0.5",
      reason: "Medical appointment"
    }
  });

  await prisma.report.createMany({
    data: [
      {
        clientId: clientA.id,
        authorId: marketerA.id,
        reviewerId: admin.id,
        workItemId: workA.id,
        reportingMonth: new Date("2026-06-01T00:00:00.000Z"),
        title: "Seoul Dental June Report",
        status: ReportStatus.REVIEW_NEEDED,
        metrics: {
          blogVisitors: 12440,
          keywordRankings: 7,
          leadInquiries: 21
        },
        notes: "Need final approval before sending."
      },
      {
        clientId: clientC.id,
        authorId: marketerB.id,
        reportingMonth: new Date("2026-06-01T00:00:00.000Z"),
        title: "Daegu Legal June Report",
        status: ReportStatus.DRAFT,
        metrics: {
          reviewCount: 18,
          placeViews: 3400
        }
      }
    ]
  });

  await prisma.calendarEvent.createMany({
    data: [
      {
        title: "Review June monthly report",
        startsAt: new Date("2026-06-30T09:00:00.000Z"),
        endsAt: new Date("2026-06-30T10:00:00.000Z"),
        provider: CalendarProvider.INTERNAL,
        kind: CalendarEventKind.REPORT_DEADLINE,
        syncStatus: ConnectionStatus.DISCONNECTED,
        clientId: clientA.id,
        workItemId: workA.id,
        createdById: admin.id
      },
      {
        title: "Busan Pilates content planning",
        startsAt: new Date("2026-07-01T01:00:00.000Z"),
        endsAt: new Date("2026-07-01T02:00:00.000Z"),
        provider: CalendarProvider.GOOGLE,
        kind: CalendarEventKind.TASK,
        syncStatus: ConnectionStatus.ERROR,
        syncError: "Google token expired",
        clientId: clientB.id,
        workItemId: workB.id,
        createdById: marketerA.id
      },
      {
        title: "Annual leave",
        startsAt: new Date("2026-07-10T00:00:00.000Z"),
        endsAt: new Date("2026-07-10T09:00:00.000Z"),
        provider: CalendarProvider.INTERNAL,
        kind: CalendarEventKind.LEAVE,
        syncStatus: ConnectionStatus.DISCONNECTED,
        leaveRequestId: approvedLeave.id,
        createdById: admin.id
      }
    ]
  });

  await prisma.auditLog.createMany({
    data: [
      {
        actorId: superAdmin.id,
        action: "SEED_CREATED",
        targetType: "User",
        targetId: admin.id
      },
      {
        actorId: admin.id,
        action: "WORK_REVIEW_REQUESTED",
        targetType: "WorkItem",
        targetId: workA.id
      },
      {
        actorId: admin.id,
        action: "LEAVE_APPROVED",
        targetType: "LeaveRequest",
        targetId: approvedLeave.id
      }
    ]
  });

  const summary = {
    users: await prisma.user.count(),
    clients: await prisma.client.count(),
    workItems: await prisma.workItem.count(),
    billingRecords: await prisma.billingRecord.count(),
    expenseRecords: await prisma.expenseRecord.count(),
    leaveRequests: await prisma.leaveRequest.count(),
    reports: await prisma.report.count()
  };

  console.log("Seeded ERP demo data:", summary);
}

main()
  .catch((error) => {
    console.error("Failed to seed ERP demo data", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
