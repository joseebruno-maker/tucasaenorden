
-- Backfill: crear gastos para pagos ya registrados que no generaron gasto
DO $$
DECLARE
  _h record;
  _new_expense_id uuid;
BEGIN
  FOR _h IN
    SELECT ph.id AS history_id, ph.household_id, ph.paid_by, ph.paid_at, ph.amount, ph.currency,
           p.name AS payment_name, p.expense_category_id
    FROM public.payment_history ph
    JOIN public.payments p ON p.id = ph.payment_id
    WHERE ph.expense_id IS NULL AND ph.amount IS NOT NULL
  LOOP
    INSERT INTO public.expenses (household_id, category_id, amount, currency, description, spent_at, created_by)
    VALUES (_h.household_id, _h.expense_category_id, _h.amount, _h.currency, _h.payment_name, _h.paid_at::date, _h.paid_by)
    RETURNING id INTO _new_expense_id;

    UPDATE public.payment_history SET expense_id = _new_expense_id WHERE id = _h.history_id;
  END LOOP;
END $$;
