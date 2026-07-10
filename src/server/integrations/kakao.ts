// 목표 경로: src/server/integrations/kakao.ts
//
// 카카오 알림톡 발송 — "키 넣으면 켜짐". env 3종이 있으면 실제 발송을 시도하고,
// 없으면 미연동으로 반환(호출부가 링크 복사/문자 대체로 폴백).
//
// 주의: 알림톡은 카카오 비즈채널 + 템플릿 사전승인이 필요하다. ENDPOINT/페이로드는
// 사용하는 발송 대행사(예: NHN Toast, Solapi, 알리고)에 맞춰 조정해야 한다.

export type AlimtalkResult = { ok: boolean; provider: "kakao" | "none"; skipped?: string };

export function kakaoAlimtalkConfigured(): boolean {
  return Boolean(process.env.KAKAO_ALIMTALK_API_KEY && process.env.KAKAO_ALIMTALK_SENDER && process.env.KAKAO_ALIMTALK_ENDPOINT);
}

// E.164/하이픈 제거 정도의 최소 정규화.
function normalizePhone(phone: string): string {
  return phone.replace(/[^0-9]/g, "");
}

/**
 * 알림톡 1건 발송. 미연동이면 { ok:false, provider:"none" }으로 조용히 반환한다.
 * @param to 수신 전화번호
 * @param text 본문(템플릿과 일치해야 함)
 * @param link 버튼 링크(선택)
 * @param templateCode 승인된 템플릿 코드(선택, 기본 env)
 */
export async function sendAlimtalk(params: { to: string; text: string; link?: string; templateCode?: string }): Promise<AlimtalkResult> {
  if (!kakaoAlimtalkConfigured()) return { ok: false, provider: "none", skipped: "NOT_CONFIGURED" };
  const to = normalizePhone(params.to);
  if (!to) return { ok: false, provider: "none", skipped: "NO_RECIPIENT" };

  const endpoint = process.env.KAKAO_ALIMTALK_ENDPOINT as string;
  const apiKey = process.env.KAKAO_ALIMTALK_API_KEY as string;
  const sender = process.env.KAKAO_ALIMTALK_SENDER as string; // 발신 프로필/발신번호
  const templateCode = params.templateCode ?? process.env.KAKAO_ALIMTALK_TEMPLATE ?? "";

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        senderKey: sender,
        templateCode,
        to,
        text: params.text,
        buttons: params.link ? [{ type: "WL", name: "바로가기", linkMo: params.link, linkPc: params.link }] : []
      })
    });
    return { ok: res.ok, provider: "kakao", skipped: res.ok ? undefined : `HTTP_${res.status}` };
  } catch {
    return { ok: false, provider: "kakao", skipped: "FETCH_ERROR" };
  }
}
