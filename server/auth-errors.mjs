// Never include raw exception messages: database errors can contain connection details.
export function authFailureCode(error) {
  const failures = [];
  for (let current = error, i = 0; current && i < 5; current = current.cause, i++) failures.push(current);
  if (failures.some(item => ['42P01', '42703'].includes(item.code) || item.name === 'SchemaMismatchError')) return 'AUTH_SCHEMA_NOT_READY';
  if (failures.some(item => ['ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND', 'ETIMEDOUT', '28P01', '3D000', 'DEPTH_ZERO_SELF_SIGNED_CERT', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'CERT_HAS_EXPIRED', 'SELF_SIGNED_CERT_IN_CHAIN'].includes(item.code))) return 'AUTH_DATABASE_UNAVAILABLE';
  if (failures.some(item => item.code === 'ERR_INVALID_URL' || item.message === 'Authentication is not configured.')) return 'AUTH_CONFIGURATION_INVALID';
  return 'AUTH_SERVICE_UNAVAILABLE';
}
