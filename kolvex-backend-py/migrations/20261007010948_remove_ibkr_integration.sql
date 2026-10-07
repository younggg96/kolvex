-- Retire IBKR and its credentials; retain shared histories with unknown provenance.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

LOCK TABLE public.ibkr_connections, public.ibkr_accounts,
    public.ibkr_positions, public.ibkr_trades, public.portfolio_connections,
    public.portfolio_accounts, public.portfolio_positions IN ACCESS EXCLUSIVE MODE;

-- Remove only portfolio caches explicitly attributed to IBKR.
DELETE FROM public.portfolio_connections WHERE provider = 'ibkr';
ALTER TABLE public.portfolio_connections DROP CONSTRAINT portfolio_connections_provider_check;
ALTER TABLE public.portfolio_connections ADD CONSTRAINT portfolio_connections_provider_check
    CHECK (provider NOT IN ('robinhood', 'ibkr'));

DROP TABLE public.ibkr_positions RESTRICT;
DROP TABLE public.ibkr_accounts RESTRICT;
DROP TABLE public.ibkr_trades RESTRICT;
DROP TABLE public.ibkr_connections RESTRICT;
