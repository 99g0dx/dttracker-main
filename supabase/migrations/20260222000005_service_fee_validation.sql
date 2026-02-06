-- Migration: Add validation for service fee transactions
-- Ensures service fee transactions are properly linked and validated

-- Function to validate service fee transaction
CREATE OR REPLACE FUNCTION public.validate_service_fee_transaction()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- If this is a service_fee transaction, ensure it has a reference
  IF NEW.type = 'service_fee' THEN
    IF NEW.reference_type IS NULL OR NEW.reference_id IS NULL THEN
      RAISE EXCEPTION 'Service fee transactions must have reference_type and reference_id';
    END IF;
    
    -- Service fee amount should match the calculated fee
    IF NEW.service_fee_amount IS NULL OR NEW.service_fee_amount <= 0 THEN
      RAISE EXCEPTION 'Service fee transactions must have a positive service_fee_amount';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for service fee validation
DROP TRIGGER IF EXISTS validate_service_fee_transaction_trigger ON public.wallet_transactions;
CREATE TRIGGER validate_service_fee_transaction_trigger
  BEFORE INSERT OR UPDATE ON public.wallet_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_service_fee_transaction();

COMMENT ON FUNCTION public.validate_service_fee_transaction() IS 'Validates that service fee transactions have proper references and amounts';
