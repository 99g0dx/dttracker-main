-- Migration: Create service fee calculation functions
-- Provides consistent service fee calculation across the platform

-- Function to get service fee rate (currently 10%)
CREATE OR REPLACE FUNCTION public.get_service_fee_rate()
RETURNS NUMERIC
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT 0.10::NUMERIC;
$$;

-- Function to calculate service fee from base amount
CREATE OR REPLACE FUNCTION public.calculate_service_fee(amount NUMERIC)
RETURNS NUMERIC
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT ROUND(amount * public.get_service_fee_rate(), 2);
$$;

-- Function to calculate total cost with service fee
CREATE OR REPLACE FUNCTION public.calculate_total_with_service_fee(amount NUMERIC)
RETURNS NUMERIC
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT ROUND(amount + public.calculate_service_fee(amount), 2);
$$;

COMMENT ON FUNCTION public.get_service_fee_rate() IS 'Returns the platform service fee rate (currently 10%)';
COMMENT ON FUNCTION public.calculate_service_fee(NUMERIC) IS 'Calculates 10% service fee from base amount';
COMMENT ON FUNCTION public.calculate_total_with_service_fee(NUMERIC) IS 'Calculates total cost including service fee';
