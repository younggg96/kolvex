-- Retire Robinhood without deleting IBKR or shared portfolio tables.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

LOCK TABLE public.robinhood_connections, public.robinhood_stock_orders,
    public.robinhood_option_orders, public.portfolio_connections,
    public.portfolio_accounts, public.portfolio_positions,
    public.portfolio_snapshots, public.ibkr_connections IN ACCESS EXCLUSIVE MODE;

-- Snapshots have no provider column. Refuse to remove ambiguous histories.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM public.ibkr_connections i
        WHERE i.user_id IN (
            SELECT user_id FROM public.robinhood_connections
            UNION SELECT user_id FROM public.portfolio_connections WHERE provider = 'robinhood'
        )
    ) OR EXISTS (
        SELECT 1 FROM public.portfolio_connections c
        WHERE c.provider <> 'robinhood' AND c.user_id IN (
            SELECT user_id FROM public.robinhood_connections
            UNION SELECT user_id FROM public.portfolio_connections WHERE provider = 'robinhood'
        )
    ) THEN
        RAISE EXCEPTION 'Mixed broker snapshots require separate review';
    END IF;
END $$;

DELETE FROM public.portfolio_snapshots
WHERE user_id IN (
    SELECT user_id FROM public.robinhood_connections
    UNION SELECT user_id FROM public.portfolio_connections WHERE provider = 'robinhood'
);

-- Foreign keys remove the corresponding accounts and positions.
DELETE FROM public.portfolio_connections WHERE provider = 'robinhood';
ALTER TABLE public.portfolio_connections DROP CONSTRAINT portfolio_connections_provider_check;
ALTER TABLE public.portfolio_connections ADD CONSTRAINT portfolio_connections_provider_check CHECK (provider = 'ibkr');

DROP TABLE public.robinhood_option_orders RESTRICT;
DROP TABLE public.robinhood_stock_orders RESTRICT;
DROP TABLE public.robinhood_connections RESTRICT;
