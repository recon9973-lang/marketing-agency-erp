// 목표 경로: src/server/repositories/hospital-profile.ts
//
// 병원 프로파일(Source of Truth) 조회. 권한은 호출부(액션/페이지)에서 거래처 접근으로 확인.
import { db } from "@/server/db";

export type HospitalProfileData = {
  departments: string | null;
  doctors: string | null;
  strengths: string | null;
  cautionTerms: string | null;
  preferredTone: string | null;
  prohibitedClaims: string | null;
  competitorHospitals: string | null;
  medicalLawNotes: string | null;
  sotVersion: number;
  updatedAt: string;
};

/** 거래처의 병원 프로파일. 없으면 null(아직 미작성). */
export async function getHospitalProfile(clientId: string): Promise<HospitalProfileData | null> {
  const p = await db.hospitalProfile.findUnique({ where: { clientId } });
  if (!p) return null;
  return {
    departments: p.departments,
    doctors: p.doctors,
    strengths: p.strengths,
    cautionTerms: p.cautionTerms,
    preferredTone: p.preferredTone,
    prohibitedClaims: p.prohibitedClaims,
    competitorHospitals: p.competitorHospitals,
    medicalLawNotes: p.medicalLawNotes,
    sotVersion: p.sotVersion,
    updatedAt: p.updatedAt.toISOString()
  };
}
