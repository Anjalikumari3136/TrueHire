import api from "./axios.js";

export async function signupApi(data) {
  const response = await api.post("/api/auth/signup", data);
  return response.data;
}

/**
 * Verify the OTP sent during signup.
 * On success, returns { token, user }.
 */
export async function verifyOTPApi({ email, otp }) {
  const response = await api.post("/api/auth/verify-otp", { email, otp });
  return response.data;
}

export async function resendOTPApi({ email }) {
  const response = await api.post("/api/auth/resend-otp", { email });
  return response.data;
}

export async function loginApi({ email, password }) {
  const response = await api.post("/api/auth/login", { email, password });
  return response.data;
}

export async function forgotPasswordApi({ email }) {
  const response = await api.post("/api/auth/forgot-password", { email });
  return response.data;
}

export async function verifyResetOTPApi({ email, otp }) {
  const response = await api.post("/api/auth/verify-reset-otp", { email, otp });
  return response.data;
}


export async function resetPasswordApi({ email, otp, newPassword }) {
  const response = await api.post("/api/auth/reset-password", { email, otp, newPassword });
  return response.data;
}


export async function getMeApi() {
  const response = await api.get("/api/auth/me");
  return response.data;
}


export async function updateProfileApi(data) {
  const response = await api.put("/api/auth/profile", data);
  return response.data;
}


export async function updatePasswordApi(data) {
  const response = await api.put("/api/auth/password", data);
  return response.data;
}


export async function deleteAccountApi() {
  const response = await api.delete("/api/auth/account");
  return response.data;
}

export async function uploadAvatarApi(formData) {
  const response = await api.post("/api/auth/avatar", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
}

export async function googleLoginApi({ idToken, signUpIfNotFound = false }) {
  const response = await api.post("/api/auth/google", { idToken, signUpIfNotFound });
  return response.data;
}


