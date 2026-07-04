"use server";

/**
 * 보고서 메일 발송 server action (워크플로우 8차).
 *
 * 거래처 담당자에게 월간 보고서를 메일로 보낸다. 접근 권한이 있는 직원만 가능.
 * 이메일 미연동 시 실제로 보내지 않고 "미리보기"를 돌려준다.
 */
import { sendReportEmailSchema } from "@/domain/report";
import { runAction, type ActionResult } from "@/server/action-result";
import { requireClientAccess, requireCurrentUser } from "@/server/authorization";
import { buildReportEmail } from "@/server/email/report-template";
import { notFound, validationError } from "@/server/errors";
import { sendEmail } from "@/server/integrations/email";
import { getReportAccessInfo, getReportEmailData } from "@/server/repositories/reports";

function formDataToObject(formData: FormData) {
  const record: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") record[key] = value;
  }
  return record;
}

export type SendReportEmailState = ActionResult<{
  sent: boolean;
  to: string;
  subject: string;
  html: string;
}>;

export async function sendReportEmailAction(
  _prevState: SendReportEmailState | null,
  formData: FormData
): Promise<SendReportEmailState> {
  return runAction(async () => {
    const user = await requireCurrentUser();
    const { id, to } = sendReportEmailSchema.parse(formDataToObject(formData));

    const access = await getReportAccessInfo(id);
    if (!access) {
      throw notFound("보고서를 찾을 수 없습니다.");
    }
    await requireClientAccess(user, access.clientId, {
      assignedMarketerId: access.clientAssignedMarketerId
    });

    const data = await getReportEmailData(id);
    if (!data) {
      throw notFound("보고서를 찾을 수 없습니다.");
    }

    const recipient = to ?? data.contactEmail ?? "";
    if (!recipient) {
      throw validationError("받는 사람 이메일이 없습니다. 거래처 담당자 이메일을 등록하거나 직접 입력해주세요.", {
        to: ["받는 사람 이메일을 입력해주세요."]
      });
    }

    const message = buildReportEmail(data, recipient);
    const result = await sendEmail(message);

    return {
      sent: result.sent,
      to: recipient,
      subject: message.subject,
      html: message.html
    };
  });
}
