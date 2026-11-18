-- Allow manually imported holdings as their own portfolio connection provider.
-- Earlier migrations left this constraint in different shapes depending on the
-- order they ran in, so replace it with the providers the code writes today.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $$
DECLARE
    unexpected TEXT;
BEGIN
    SELECT string_agg(DISTINCT provider, ', ')
      INTO unexpected
      FROM public.portfolio_connections
     WHERE provider NOT IN ('plaid', 'manual');
    IF unexpected IS NOT NULL THEN
        RAISE EXCEPTION 'portfolio_connections has unsupported providers: %', unexpected;
    END IF;
END $$;

ALTER TABLE public.portfolio_connections
    DROP CONSTRAINT IF EXISTS portfolio_connections_provider_check;
ALTER TABLE public.portfolio_connections
    ADD CONSTRAINT portfolio_connections_provider_check
    CHECK (provider IN ('plaid', 'manual'));
