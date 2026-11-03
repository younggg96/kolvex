import { Copy, Failure } from "./UI";
export function MutationStatus({
  error,
  message,
}: {
  error?: string;
  message?: string;
}) {
  return (
    <>
      {!!error && <Failure message={error} />}
      {!!message && <Copy>{message}</Copy>}
    </>
  );
}
