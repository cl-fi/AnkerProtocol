const OBJECT_ID_PATTERN = '0x[0-9a-fA-F]+';

export function isAllowedPredictProxyPath(path: string) {
  return (
    path === 'status' ||
    path === 'managers' ||
    new RegExp(`^predicts/${OBJECT_ID_PATTERN}/oracles$`).test(path) ||
    new RegExp(`^predicts/${OBJECT_ID_PATTERN}/vault/summary$`).test(path) ||
    new RegExp(`^oracles/${OBJECT_ID_PATTERN}/state$`).test(path)
  );
}
