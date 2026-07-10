const OBJECT_ID_PATTERN = '0x[0-9a-fA-F]+';

export function isAllowedPropbookProxyPath(path: string) {
  return new RegExp(`^oracles/${OBJECT_ID_PATTERN}/pyth/latest$`).test(path);
}
