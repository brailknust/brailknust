export type AssessmentForAverage = {
  score: unknown;
  maxScore: unknown;
  weight?: unknown;
};

export function calculateAssessmentAverage(items: AssessmentForAverage[]) {
  const valid = items.filter((item) => {
    const score = Number(item.score);
    const maxScore = Number(item.maxScore);
    return Number.isFinite(score) && Number.isFinite(maxScore) && maxScore > 0 && score >= 0 && score <= maxScore;
  });
  if (!valid.length) return 0;

  const weighted = valid.filter((item) => item.weight !== null && item.weight !== undefined && Number(item.weight) > 0);
  if (weighted.length === valid.length) {
    const totalWeight = weighted.reduce((sum, item) => sum + Number(item.weight), 0);
    if (totalWeight > 0) {
      return weighted.reduce(
        (sum, item) => sum + (Number(item.score) / Number(item.maxScore)) * 100 * Number(item.weight),
        0,
      ) / totalWeight;
    }
  }

  return valid.reduce((sum, item) => sum + (Number(item.score) / Number(item.maxScore)) * 100, 0) / valid.length;
}

export type AttendanceRecordForSummary = {
  status: "ATTENDED" | "MISSED" | "CANCELLED" | "EXCUSED" | "UNCONFIRMED";
};

// Only confirmed classes count: CANCELLED/EXCUSED are neither the student's
// attendance nor absence, and UNCONFIRMED hasn't been answered yet.
export function calculateConfirmedAttendance(records: AttendanceRecordForSummary[]) {
  const confirmed = records.filter((record) => record.status === "ATTENDED" || record.status === "MISSED");
  if (!confirmed.length) return null;

  const attended = confirmed.filter((record) => record.status === "ATTENDED").length;
  return {
    attended,
    total: confirmed.length,
    percentage: Math.round((attended / confirmed.length) * 100),
  };
}
