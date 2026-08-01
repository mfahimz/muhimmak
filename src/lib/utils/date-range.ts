export function getPresetDates(preset: "7d" | "30d" | "90d"): { startDate: string; endDate: string } {
  const endDateObj = new Date();
  const endDate = endDateObj.toISOString().split("T")[0];

  let days = 29;
  if (preset === "7d") days = 6;
  if (preset === "90d") days = 89;

  const startDateObj = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const startDate = startDateObj.toISOString().split("T")[0];

  return { startDate, endDate };
}
