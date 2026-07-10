const OBJECT_ID_PATTERN = '0x[0-9a-fA-F]+';

export function isAllowedPredictProxyPath(path: string) {
  return (
    path === 'status' ||
    path === 'markets' ||
    new RegExp(`^markets/${OBJECT_ID_PATTERN}/state$`).test(path)
  );
}
