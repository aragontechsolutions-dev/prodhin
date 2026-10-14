import { useMutation, useQueryClient } from '@tanstack/react-query';
import { REGISTER_COMPETITOR_KEY, registerCompetitor, type RegisterCompetitorInput } from '../lib/competitors';

export function useRegisterCompetitor() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: REGISTER_COMPETITOR_KEY,
    mutationFn: registerCompetitor,
    onSettled: () => qc.invalidateQueries({ queryKey: ['my-competitors'] }),
  });
}

export type { RegisterCompetitorInput };
