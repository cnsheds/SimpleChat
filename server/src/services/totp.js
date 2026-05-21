import { totp } from 'otplib';

totp.options = {
  step: 7200,
  window: 1,
  digits: 6
};

export function verifyTotp(code) {
  const secret = process.env.TOTP_SECRET || 'JBSWY3DPEHPK3PXP';
  return totp.check(String(code || '').trim(), secret);
}

export function currentTotp() {
  const secret = process.env.TOTP_SECRET || 'JBSWY3DPEHPK3PXP';
  return totp.generate(secret);
}
