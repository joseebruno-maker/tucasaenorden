
ALTER TABLE public.payments
  ADD COLUMN expense_category_id uuid REFERENCES public.expense_categories(id) ON DELETE SET NULL;

ALTER TABLE public.payment_history
  ADD COLUMN expense_id uuid REFERENCES public.expenses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_payments_expense_category ON public.payments(expense_category_id);
CREATE INDEX IF NOT EXISTS idx_payment_history_expense ON public.payment_history(expense_id);
