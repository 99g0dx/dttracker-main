-- Migration: Wallet scope RPCs (2/6) - Drop unlock_activation_payment (replaced by release_sm_panel_payment).

DROP FUNCTION IF EXISTS public.unlock_activation_payment(UUID, NUMERIC);
