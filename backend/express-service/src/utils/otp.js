export function generateOTP() {
  const otp = Math.floor(100000 + Math.random() * 900000);
  return otp.toString();
}

export function getOTPExpiry() {
  return new Date(Date.now() + 10 * 60 * 1000);
}
