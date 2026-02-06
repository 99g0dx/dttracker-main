# Wallet-Activation Synchronization

This document describes the synchronization mechanisms implemented to keep wallet and activation states in sync.

## Migration: `20260216000001_wallet_activation_sync.sql`

### Features Implemented

#### 1. **Validation View: `wallet_activation_sync_state`**
   - Computes expected wallet state from activations
   - Shows actual vs expected `locked_balance`
   - Tracks total budget locked and spent across activations
   - Identifies discrepancies automatically

#### 2. **Validation Function: `validate_wallet_activation_sync(workspace_id)`**
   - Validates that wallet `locked_balance` matches expected from activations
   - Returns JSON with validation result and details
   - Allows 0.01 NGN tolerance for rounding differences

#### 3. **Enhanced Reconciliation: `reconcile_wallet_with_activations(workspace_id, date)`**
   - Combines standard wallet reconciliation with activation state validation
   - Returns overall sync status: `synced` or `discrepancy`
   - Provides comprehensive reconciliation report

#### 4. **Trigger: `validate_wallet_operation_trigger`**
   - Automatically validates wallet operations after updates
   - Logs warnings when discrepancies > 1 NGN detected
   - Runs after each `workspace_wallets` update

#### 5. **Auto-Fix Function: `auto_fix_wallet_activation_sync(workspace_id, threshold)`**
   - Automatically fixes small discrepancies (< threshold, default 10 NGN)
   - Handles both over-locked and under-locked scenarios
   - Creates audit trail via `wallet_transactions`
   - Only fixes if sufficient balance available

#### 6. **Idempotency Enhancement: `release_sm_panel_payment`**
   - Added idempotency check to prevent duplicate payment processing
   - Checks for existing completed transaction before processing
   - Returns early if already processed

#### 7. **Performance Indexes**
   - `idx_activations_workspace_status` - Fast activation lookups
   - `idx_wallet_transactions_reference` - Fast transaction lookups

## Usage Examples

### Check Sync Status
```sql
-- View current sync state
SELECT * FROM public.wallet_activation_sync_state 
WHERE workspace_id = 'your-workspace-id';
```

### Validate Sync
```sql
-- Validate wallet matches activation state
SELECT public.validate_wallet_activation_sync('your-workspace-id');
```

### Full Reconciliation
```sql
-- Run comprehensive reconciliation
SELECT public.reconcile_wallet_with_activations('your-workspace-id');
```

### Auto-Fix Small Issues
```sql
-- Auto-fix discrepancies < 10 NGN
SELECT public.auto_fix_wallet_activation_sync('your-workspace-id', 10.00);
```

## How It Works

### Synchronization Flow

1. **Activation Publishing** (`activation-publish` Edge Function)
   - Locks budget: `balance` → `locked_balance`
   - Creates `lock` transaction
   - Trigger validates operation

2. **Creator Joins** (`join_sm_panel_atomic` RPC)
   - Checks sufficient `locked_balance`
   - Increments `activations.spent_amount`
   - No wallet change (already locked)

3. **Payment Release** (`release_sm_panel_payment` RPC)
   - Unlocks payment: `locked_balance` decreases
   - Credits creator wallet
   - Creates `unlock` transaction
   - Idempotency check prevents duplicates

4. **Cancellation/Finalization** (`cancel_sm_panel_activation` / `finalize_sm_panel_activation`)
   - Refunds unused budget: `locked_balance` → `balance`
   - Creates `refund` transaction
   - Trigger validates operation

### Validation Logic

The sync state view calculates:
- **Expected Locked** = Sum of (total_budget - spent_amount) for all live/draft activations
- **Actual Locked** = Current `workspace_wallets.locked_balance`
- **Discrepancy** = Actual - Expected

### Tolerance Levels

- **0.01 NGN**: Validation tolerance (rounding differences)
- **1 NGN**: Warning threshold (trigger logs warning)
- **10 NGN**: Auto-fix threshold (default, configurable)

## Monitoring

### View Sync Issues
```sql
-- Find workspaces with sync discrepancies
SELECT workspace_id, locked_discrepancy, live_activation_count
FROM public.wallet_activation_sync_state
WHERE ABS(locked_discrepancy) > 1;
```

### Check Recent Reconciliations
```sql
-- View reconciliation history
SELECT * FROM public.wallet_reconciliations
WHERE workspace_id = 'your-workspace-id'
ORDER BY reconciliation_date DESC
LIMIT 10;
```

## Best Practices

1. **Regular Reconciliation**: Run `reconcile_wallet_with_activations()` daily
2. **Monitor Warnings**: Check logs for trigger warnings
3. **Auto-Fix Threshold**: Set appropriate threshold based on your tolerance
4. **Manual Review**: Review discrepancies > auto-fix threshold manually
5. **Audit Trail**: All fixes create `wallet_transactions` entries

## Troubleshooting

### Discrepancy Found

1. **Check Activation State**
   ```sql
   SELECT id, status, type, total_budget, spent_amount
   FROM public.activations
   WHERE workspace_id = 'your-workspace-id'
     AND status IN ('live', 'draft');
   ```

2. **Check Wallet Transactions**
   ```sql
   SELECT type, amount, reference_type, reference_id, created_at
   FROM public.wallet_transactions
   WHERE workspace_id = 'your-workspace-id'
   ORDER BY created_at DESC;
   ```

3. **Run Validation**
   ```sql
   SELECT public.validate_wallet_activation_sync('your-workspace-id');
   ```

4. **Auto-Fix (if small)**
   ```sql
   SELECT public.auto_fix_wallet_activation_sync('your-workspace-id', 10.00);
   ```

### Common Issues

- **Race Conditions**: Multiple creators joining simultaneously - handled by RPC atomicity
- **Partial Failures**: Edge Function failures - use idempotency checks
- **Budget Changes**: Activation budget changed after publishing - manual review required
- **Rounding Errors**: Small discrepancies (< 0.01 NGN) - automatically tolerated

## Future Enhancements

- [ ] Add `sync_issues` table for tracking discrepancies
- [ ] Extend `wallet_alerts` to support sync alerts
- [ ] Add scheduled job for automatic reconciliation
- [ ] Add notification system for large discrepancies
- [ ] Add admin dashboard for sync monitoring
