const clean = (value, max = 500) => String(value ?? "").trim().slice(0, max);
const escapeHtml = (value) => clean(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);

export default async function handler(request, response) {
  if (request.method !== "POST") return response.status(405).json({ error: "허용되지 않은 요청입니다." });

  const body = request.body || {};
  if (clean(body.website, 100)) return response.status(200).json({ ok: true });

  const data = {
    institutionName: clean(body.institutionName, 80),
    facilityCode: clean(body.facilityCode, 20),
    product: clean(body.product, 50),
    contactName: clean(body.contactName, 40),
    phone: clean(body.phone, 20),
    message: clean(body.message, 500),
  };

  if (!data.institutionName || !data.facilityCode || !data.product || !data.contactName || !data.phone || body.consent !== true) {
    return response.status(400).json({ error: "필수 항목과 개인정보 동의를 확인해주세요." });
  }

  const allowedProducts = new Set(["ULTRACOL", "YVOIRE", "YVOIRE Y-SOLUTION", "BELLACHOLINE", "KIOMER", "TRIDERM", "AIRSHINE", "PDO LIFTING THREAD"]);
  if (!allowedProducts.has(data.product)) return response.status(400).json({ error: "신청 제품을 다시 선택해주세요." });

  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  const notifyEmail = process.env.SAMPLE_NOTIFY_EMAIL;
  if (!apiKey || !fromEmail || !notifyEmail) return response.status(503).json({ error: "메일 접수 설정이 아직 완료되지 않았습니다." });

  const emailResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: fromEmail,
      to: [notifyEmail],
      subject: `[LYV 샘플 신청] ${data.institutionName} · ${data.product}`,
      html: `<h2>새 샘플 신청이 접수되었습니다.</h2><table style="border-collapse:collapse;width:100%;max-width:620px"><tr><th style="text-align:left;padding:9px;border-bottom:1px solid #ddd">병·의원명</th><td style="padding:9px;border-bottom:1px solid #ddd">${escapeHtml(data.institutionName)}</td></tr><tr><th style="text-align:left;padding:9px;border-bottom:1px solid #ddd">요양기관기호</th><td style="padding:9px;border-bottom:1px solid #ddd">${escapeHtml(data.facilityCode)}</td></tr><tr><th style="text-align:left;padding:9px;border-bottom:1px solid #ddd">신청 제품</th><td style="padding:9px;border-bottom:1px solid #ddd">${escapeHtml(data.product)}</td></tr><tr><th style="text-align:left;padding:9px;border-bottom:1px solid #ddd">담당자</th><td style="padding:9px;border-bottom:1px solid #ddd">${escapeHtml(data.contactName)}</td></tr><tr><th style="text-align:left;padding:9px;border-bottom:1px solid #ddd">연락처</th><td style="padding:9px;border-bottom:1px solid #ddd"><a href="tel:${escapeHtml(data.phone)}">${escapeHtml(data.phone)}</a></td></tr><tr><th style="text-align:left;padding:9px;border-bottom:1px solid #ddd">요청사항</th><td style="padding:9px;border-bottom:1px solid #ddd;white-space:pre-wrap">${escapeHtml(data.message || "없음")}</td></tr></table>`,
      text: `새 샘플 신청\n병·의원명: ${data.institutionName}\n요양기관기호: ${data.facilityCode}\n제품: ${data.product}\n담당자: ${data.contactName}\n연락처: ${data.phone}\n요청사항: ${data.message || "없음"}`,
    }),
  });

  if (!emailResponse.ok) {
    console.error("Resend error", emailResponse.status, await emailResponse.text());
    return response.status(502).json({ error: "메일 전송에 실패했습니다. 잠시 후 다시 시도해주세요." });
  }
  return response.status(201).json({ ok: true });
}
