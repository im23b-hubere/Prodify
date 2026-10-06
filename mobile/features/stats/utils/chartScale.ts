export const CHART_MONTH_DAYS = 30;
export const CHART_ALL_WEEK_FIT = 30;

export function chartShowsHourLabels(_barCount?: number): boolean {
  return false;
}

export function isMonthBarLabel(label: string): boolean {
  return /^\d{4}-\d{2}$/.test(label);
}
