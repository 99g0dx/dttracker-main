-- Migration: Trigger to update wallet_alerts.last_triggered_at when balance drops below threshold
-- Phase 2 of wallet improvements plan.

CREATE OR REPLACE FUNCTION public.check_wallet_alerts_after_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.balance IS DISTINCT FROM OLD.balance THEN
    UPDATE public.wallet_alerts
    SET last_triggered_at = NOW(),
        updated_at = NOW()
    WHERE workspace_id = NEW.workspace_id
      AND alert_type = 'low_balance'
      AND enabled
      AND threshold IS NOT NULL
      AND NEW.balance < threshold
      AND (last_triggered_at IS NULL OR last_triggered_at < NOW() - INTERVAL '1 day');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS wallet_alerts_after_update ON public.workspace_wallets;
CREATE TRIGGER wallet_alerts_after_update
  AFTER UPDATE OF balance ON public.workspace_wallets
  FOR EACH ROW
  EXECUTE PROCEDURE public.check_wallet_alerts_after_update();
