// 목표 경로: src/components/contracts/ContractProducts.tsx
//
// 계약 상품 구성(R1) — 상품 마스터에서 선택해 월단가·광고비·수량을 붙이고 합계를 본다.
// SIGNED 계약은 잠금(추가/삭제 불가).
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { addContractProduct, removeContractProduct } from "@/server/actions/contract-products";

type ProductRow = {
  id: string;
  productId: string;
  name: string;
  category: string;
  monthlyFee: number | null;
  adBudget: number | null;
  quantity: number;
  notes: string | null;
};
type Option = { id: string; name: string; category: string };

const won = new Intl.NumberFormat("ko-KR");
const inputCls = "w-full rounded-md border border-line px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand";

export function ContractProducts({
  contractId,
  products,
  monthlyTotal,
  adBudgetTotal,
  options,
  locked
}: {
  contractId: string;
  products: ProductRow[];
  monthlyTotal: number;
  adBudgetTotal: number;
  options: Option[];
  locked: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [productId, setProductId] = useState("");
  const [monthlyFee, setMonthlyFee] = useState("");
  const [adBudget, setAdBudget] = useState("");
  const [quantity, setQuantity] = useState("1");

  function onAdd() {
    setError(null);
    if (!productId) return setError("상품을 선택하세요.");
    start(async () => {
      const res = await addContractProduct({
        contractId,
        productId,
        monthlyFee: monthlyFee ? Number(monthlyFee) : null,
        adBudget: adBudget ? Number(adBudget) : null,
        quantity: quantity ? Number(quantity) : 1
      });
      if (!res.ok) {
        setError(res.error === "CONTRACT_LOCKED" ? "서명 완료된 계약은 상품을 수정할 수 없습니다." : "상품 추가에 실패했습니다.");
        return;
      }
      setProductId("");
      setMonthlyFee("");
      setAdBudget("");
      setQuantity("1");
      router.refresh();
    });
  }

  function onRemove(id: string) {
    start(async () => {
      const res = await removeContractProduct({ id });
      if (!res.ok) {
        setError("상품 삭제에 실패했습니다.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <section className="rounded-2xl border border-line bg-white p-5 print:break-inside-avoid">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-ink">상품 구성</h3>
        {locked ? <span className="text-xs text-slate-400">서명 완료 — 잠김</span> : null}
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-slate-500">
              <th className="py-2">상품</th>
              <th className="py-2">분류</th>
              <th className="py-2 text-right">월 대행료</th>
              <th className="py-2 text-right">월 광고비</th>
              <th className="py-2 text-center">수량</th>
              {!locked ? <th className="py-2" /> : null}
            </tr>
          </thead>
          <tbody>
            {products.length === 0 ? (
              <tr>
                <td colSpan={locked ? 5 : 6} className="py-6 text-center text-slate-400">
                  아직 상품이 없습니다.{locked ? "" : " 아래에서 추가하세요."}
                </td>
              </tr>
            ) : (
              products.map((p) => (
                <tr key={p.id} className="border-b border-line/60">
                  <td className="py-2 font-medium text-ink">{p.name}</td>
                  <td className="py-2 text-slate-500">{p.category}</td>
                  <td className="py-2 text-right text-ink">{p.monthlyFee != null ? `${won.format(p.monthlyFee)}원` : "-"}</td>
                  <td className="py-2 text-right text-slate-600">{p.adBudget != null ? `${won.format(p.adBudget)}원` : "-"}</td>
                  <td className="py-2 text-center text-slate-600">{p.quantity}</td>
                  {!locked ? (
                    <td className="py-2 text-right">
                      <button type="button" onClick={() => onRemove(p.id)} disabled={pending} className="text-slate-400 hover:text-danger disabled:opacity-50" aria-label="삭제">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr className="border-t border-line font-semibold text-ink">
              <td className="py-2" colSpan={2}>월 합계</td>
              <td className="py-2 text-right text-brand-strong">{won.format(monthlyTotal)}원</td>
              <td className="py-2 text-right text-slate-600">{won.format(adBudgetTotal)}원</td>
              <td className="py-2" colSpan={locked ? 1 : 2} />
            </tr>
          </tfoot>
        </table>
      </div>

      {!locked ? (
        <div className="mt-4 rounded-lg border border-dashed border-line bg-surface/40 p-3">
          <div className="grid gap-2 sm:grid-cols-[1.4fr_1fr_1fr_0.6fr_auto] sm:items-end">
            <label className="block">
              <span className="text-xs font-semibold text-slate-500">상품</span>
              <select value={productId} onChange={(e) => setProductId(e.target.value)} className={inputCls}>
                <option value="">선택</option>
                {options.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-500">월 대행료</span>
              <input value={monthlyFee} onChange={(e) => setMonthlyFee(e.target.value)} type="number" min="0" className={inputCls} />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-500">월 광고비</span>
              <input value={adBudget} onChange={(e) => setAdBudget(e.target.value)} type="number" min="0" className={inputCls} />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-500">수량</span>
              <input value={quantity} onChange={(e) => setQuantity(e.target.value)} type="number" min="1" className={inputCls} />
            </label>
            <button type="button" onClick={onAdd} disabled={pending} className="inline-flex h-[34px] items-center justify-center gap-1 rounded-md bg-brand px-3 text-sm font-semibold text-white disabled:opacity-50">
              <Plus className="h-4 w-4" /> 추가
            </button>
          </div>
          {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
        </div>
      ) : null}
    </section>
  );
}
