import { EnokiClient, EnokiClientError } from '@mysten/enoki';
import { normalizeSuiAddress } from '@mysten/sui/utils';
import { SUI_NETWORK } from '../config/deepbook';
import { DEFAULT_ANKER_CONFIG, type AnkerProtocolConfig } from '../sui/ankerProtocolConfig';

/**
 * Server side of Enoki gas sponsorship. Sponsorship requires the PRIVATE Enoki
 * API key (the portal cannot enable it on public keys), so the two-step
 * create/execute exchange runs behind our API routes and the key never reaches
 * the client. ADR-0008 is preserved: the wallet signs the sponsored bytes, the
 * digest is known before execution, and the app still confirms on its own
 * client.
 */

const SUI_ADDRESS_PATTERN = /^0x[0-9a-fA-F]{64}$/;
/** Sui caps transactions at 128 KiB; base64 of that is ~176 KiB. */
const MAX_TRANSACTION_KIND_BASE64_LENGTH = 256 * 1024;
const MAX_DIGEST_LENGTH = 64;
const MAX_SIGNATURE_LENGTH = 4096;

/** Invalid caller input → HTTP 400. */
export class SponsorshipInputError extends Error {}

/** ENOKI_PRIVATE_API_KEY missing → HTTP 503. */
export class SponsorshipNotConfiguredError extends Error {
  constructor() {
    super('Gas sponsorship is not configured on this deployment.');
  }
}

export function isSponsorshipConfigured(): boolean {
  return Boolean(process.env.ENOKI_PRIVATE_API_KEY);
}

/**
 * Every Move call target the wallet flows can emit (create account wrapper,
 * subscribe, claim). Enoki refuses anything outside this list, so a stranger
 * hitting the endpoint cannot drain the sponsorship budget on arbitrary
 * packages. Guarded against drift by enokiSponsor.test.ts, which rebuilds the
 * transaction plans and checks every plan target is listed here.
 */
export function sponsoredMoveCallTargets(config: AnkerProtocolConfig = DEFAULT_ANKER_CONFIG): string[] {
  return [
    `${config.accountPackageId}::account_registry::new`,
    `${config.accountPackageId}::account::share`,
    `${config.accountPackageId}::account::generate_auth`,
    `${config.accountPackageId}::account::deposit_funds`,
    `${config.accountPackageId}::account::withdraw_funds`,
    `${config.packageId}::product_note::wrapper_balance`,
    `${config.packageId}::product_note::new_dual_investment_note_verified`,
    `${config.packageId}::product_note::record_redeem_with_fee`,
    `${config.predictPackageId}::expiry_market::load_live_pricer`,
    `${config.predictPackageId}::expiry_market::mint_exact_quantity`,
    `${config.predictPackageId}::expiry_market::redeem_settled`,
    // The coinWithBalance intent (subscribe's dUSDC top-up) resolves at build
    // time into framework calls that never appear in the plan builders' `calls`
    // arrays. With outputKind 'coin' and balance > 0 — the only shape this app
    // uses — the resolver can emit exactly these three: redeem_funds when the
    // sender's dUSDC sits in address balance (zkLogin accounts funded via
    // send_funds always hit this), send_funds returning the merged leftover to
    // the sender, and destroy_zero for the exact-balance case. Enoki compares
    // targets against the full 64-char package address ("0x2" short form is
    // silently never matched), hence the normalization.
    `${normalizeSuiAddress('0x2')}::coin::redeem_funds`,
    `${normalizeSuiAddress('0x2')}::coin::send_funds`,
    `${normalizeSuiAddress('0x2')}::coin::destroy_zero`,
  ];
}

function enokiClient(): EnokiClient {
  const apiKey = process.env.ENOKI_PRIVATE_API_KEY;
  if (!apiKey) {
    throw new SponsorshipNotConfiguredError();
  }
  return new EnokiClient({ apiKey });
}

export async function createAppSponsoredTransaction(input: {
  transactionKindBytes: unknown;
  sender: unknown;
}): Promise<{ bytes: string; digest: string }> {
  if (typeof input.sender !== 'string' || !SUI_ADDRESS_PATTERN.test(input.sender)) {
    throw new SponsorshipInputError('sender must be a 32-byte Sui address.');
  }
  if (
    typeof input.transactionKindBytes !== 'string' ||
    input.transactionKindBytes.length === 0 ||
    input.transactionKindBytes.length > MAX_TRANSACTION_KIND_BASE64_LENGTH
  ) {
    throw new SponsorshipInputError('transactionKindBytes must be a non-empty base64 string.');
  }
  return enokiClient().createSponsoredTransaction({
    network: SUI_NETWORK,
    transactionKindBytes: input.transactionKindBytes,
    sender: input.sender,
    // Payout/note transfers only ever go back to the sender.
    allowedAddresses: [input.sender],
    allowedMoveCallTargets: sponsoredMoveCallTargets(),
  });
}

export async function executeAppSponsoredTransaction(input: {
  digest: unknown;
  signature: unknown;
}): Promise<{ digest: string }> {
  if (typeof input.digest !== 'string' || input.digest.length === 0 || input.digest.length > MAX_DIGEST_LENGTH) {
    throw new SponsorshipInputError('digest must be a transaction digest string.');
  }
  if (
    typeof input.signature !== 'string' ||
    input.signature.length === 0 ||
    input.signature.length > MAX_SIGNATURE_LENGTH
  ) {
    throw new SponsorshipInputError('signature must be a base64 signature string.');
  }
  return enokiClient().executeSponsoredTransaction({
    digest: input.digest,
    signature: input.signature,
  });
}

/** Maps sponsorship errors onto HTTP responses; shared by both API routes. */
export function sponsorshipErrorResponse(error: unknown): Response {
  if (error instanceof SponsorshipNotConfiguredError) {
    return Response.json({ error: error.message }, { status: 503 });
  }
  if (error instanceof SponsorshipInputError) {
    return Response.json({ error: error.message }, { status: 400 });
  }
  if (error instanceof EnokiClientError) {
    // error.message is just "Request to Enoki API failed (status: N)"; the
    // actionable reason (e.g. which move call target was refused) is in errors.
    const detail = error.errors
      .map((entry) => entry.message)
      .filter(Boolean)
      .join('; ');
    return Response.json({ error: detail ? `${error.message}: ${detail}` : error.message }, { status: 502 });
  }
  return Response.json(
    { error: error instanceof Error ? error.message : 'Sponsorship request failed.' },
    { status: 502 },
  );
}
