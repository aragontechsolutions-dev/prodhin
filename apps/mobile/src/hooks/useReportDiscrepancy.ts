import { useMutation } from '@tanstack/react-query';
import { REPORT_DISCREPANCY_KEY, reportDiscrepancy } from '../lib/stockDiscrepancies';

export function useReportDiscrepancy() {
  return useMutation({
    mutationKey: REPORT_DISCREPANCY_KEY,
    mutationFn: reportDiscrepancy,
  });
}
