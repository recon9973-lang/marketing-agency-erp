"use server";

/**
 * 보고서 알림톡 발송 server action (워크플로우 9차).
 * 접근 권한이 있는 직원만 가능. 미연동 시 실제로 보내지 않고 "미리보기"를 돌려준다.
 */
import { sendReportAlimtalkSchema } from "@/domain/report";
import { runAction, type ActionResult } from "@/server/action-result";
import { requireClientAccess, requireCurrentUser } from "@/server/authorization";
import { notFound, validationError } from "@/server/errors";
import { sendAlimtalk } from "@/server/integrations/kakao-alimtalk";
import { buildReportAlimtalk } from "@/server/messaging/report-alimtalk";
import { getReportAccessInfo, getReportEmailData } from "@/server/repositories/reports";

function formDataToObject(formData: FormData) {
  const record: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") record[key] = value;
  }
  return record;
}

export type SendReportAlimtalkState = ActionResult<{ sent: boolean; to: string; text: string }>;

export async function sendReportAlimtalkAction(
  _prevState: SendReportAlimtalkState | null,
  formData: FormData
): Promise<SendReportAlimtalkState> {
  return runAction(async () => {
    const user = await requireCurrentUser();
    const { id, to } = sendReportAlimtalkSchema.parse(formDataToObject(formData));

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

    const recipient = to ?? data.contactPhone ?? "";
    if (!recipient) {
      throw validationError("받는 사람 번호가 없습니다. 거래처 전화번호를 등록하거나 직접 입력해주세요.", {
        to: ["받는 사람 휴대폰 번호를 입력해주세요."]
      });
    }

    const message = buildReportAlimtalk(data, recipient);
    const result = await sendAlimtalk(message);

    return { sent: result.sent, to: result.preview.to, text: message.text };
  });
}
