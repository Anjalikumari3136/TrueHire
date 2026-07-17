import bcrypt from "bcrypt";
import prisma from "../config/prisma.js";
import { generateOTP, getOTPExpiry } from "../utils/otp.js";
import { generateToken } from "../utils/jwt.js";
import { sendOTPEmail } from "../services/mail.service.js";
import supabase from "../config/supabase.js";
import { OAuth2Client } from "google-auth-library";

const SALT_ROUNDS = 12;
const BUCKET = "resumes";

async function getAvatarSignedUrl(storagePath) {
  if (!storagePath) return null;
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(storagePath, 60 * 60 * 24 * 7); // 7 days
    if (error) return null;
    return data.signedUrl;
  } catch (e) {
    return null;
  }
}

// POST /api/auth/signup
export async function signup(req, res) {
  try {
    const {
      fullName, email, password, role,
      phone, location, currentRole, experience, targetRole,
    } = req.body;

    if (!fullName || !email || !password || !role || !phone) {
      return res.status(400).json({
        success: false,
        message: "Full name, email, password, role, and phone are required.",
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: "Invalid email address." });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters.",
      });
    }
    const validRoles = ["CANDIDATE", "RECRUITER", "ADMIN", "candidate", "recruiter", "admin"];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ success: false, message: "Invalid role selected." });
    }
    const normalizedRole = role.toUpperCase();

    // Check existing user
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists.",
      });
    }
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // Generate OTP
    const otp = generateOTP();
    const otpExpiry = getOTPExpiry();

    await prisma.pendingUser.upsert({
      where: { email },
      update: {
        name: fullName,
        hashedPassword,
        role: normalizedRole,
        phone,
        location: location || null,
        currentRole: currentRole || null,
        experience: experience ? parseInt(experience) : null,
        targetRole: targetRole || null,
        otp,
        otpExpiry,
      },
      create: {
        name: fullName,
        email,
        hashedPassword,
        role: normalizedRole,
        phone,
        location: location || null,
        currentRole: currentRole || null,
        experience: experience ? parseInt(experience) : null,
        targetRole: targetRole || null,
        otp,
        otpExpiry,
      },
    });

    try {
      await sendOTPEmail(email, otp, "signup");
    } catch (mailErr) {
      console.error("[signup] Mail error:", mailErr.code, mailErr.message);
      await prisma.pendingUser.delete({ where: { email } }).catch(() => {});

      if (mailErr.code === "EAUTH") {
        return res.status(500).json({
          success: false,
          message:
            "Email service authentication failed. Please contact support.",
        });
      }
      return res.status(500).json({
        success: false,
        message: "Failed to send OTP email. Please try again later.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "OTP sent to your email. Please verify to complete registration.",
    });
  } catch (error) {
    console.error("[signup]", error);
    return res.status(500).json({ success: false, message: "Server error. Please try again." });
  }
}

export async function verifyOTP(req, res) {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ success: false, message: "Email and OTP are required." });
    }

    const pending = await prisma.pendingUser.findUnique({ where: { email } });

    if (!pending) {
      return res.status(404).json({
        success: false,
        message: "No pending signup found for this email. Please sign up again.",
      });
    }

    if (new Date() > new Date(pending.otpExpiry)) {
      return res.status(400).json({
        success: false,
        message: "OTP has expired. Please request a new one.",
      });
    }

    if (pending.otp !== otp.toString()) {
      return res.status(400).json({ success: false, message: "Invalid OTP. Please try again." });
    }

    const user = await prisma.user.create({
      data: {
        name: pending.name,
        email: pending.email,
        password: pending.hashedPassword,
        role: pending.role,
        phone: pending.phone,
        location: pending.location,
        currentRole: pending.currentRole,
        experience: pending.experience,
        targetRole: pending.targetRole,
      },
    });

    await prisma.pendingUser.delete({ where: { email } });

    const token = generateToken({ userId: user.id, email: user.email, role: user.role });

    return res.status(201).json({
      success: true,
      message: "Account created successfully. Welcome to TrueHire!",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("[verifyOTP]", error);
    return res.status(500).json({ success: false, message: "Server error. Please try again." });
  }
}

export async function resendOTP(req, res) {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required." });
    }

    const pending = await prisma.pendingUser.findUnique({ where: { email } });

    if (!pending) {
      return res.status(404).json({
        success: false,
        message: "No pending signup found for this email. Please sign up again.",
      });
    }

    const otp = generateOTP();
    const otpExpiry = getOTPExpiry();

    await prisma.pendingUser.update({
      where: { email },
      data: { otp, otpExpiry },
    });

    try {
      await sendOTPEmail(email, otp, "signup");
    } catch (mailErr) {
      console.error("[resendOTP] Mail error:", mailErr.code, mailErr.message);
      return res.status(500).json({
        success: false,
        message: "Failed to send OTP email. Please try again later.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "A new OTP has been sent to your email.",
    });
  } catch (error) {
    console.error("[resendOTP]", error);
    return res.status(500).json({ success: false, message: "Server error. Please try again." });
  }
}

export async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password are required." });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: "Invalid email address." });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    const token = generateToken({ userId: user.id, email: user.email, role: user.role });
    const profileImageSignedUrl = await getAvatarSignedUrl(user.profileImage);

    return res.status(200).json({
      success: true,
      message: "Login successful. Welcome back!",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        location: user.location,
        currentRole: user.currentRole,
        experience: user.experience,
        targetRole: user.targetRole,
        profileImage: user.profileImage,
        profileImageSignedUrl,
      },
    });
  } catch (error) {
    console.error("[login]", error);
    return res.status(500).json({ success: false, message: "Server error. Please try again." });
  }
}

// POST /api/auth/forgot-password
export async function forgotPassword(req, res) {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required." });
    }

    // Always respond positively to avoid user enumeration
    const user = await prisma.user.findUnique({ where: { email } });

    if (user) {
      const otp = generateOTP();
      const otpExpiry = getOTPExpiry();

      await prisma.passwordResetOTP.upsert({
        where: { email },
        update: { otp, otpExpiry },
        create: { email, otp, otpExpiry },
      });

      try {
        await sendOTPEmail(email, otp, "reset");
      } catch (mailErr) {
        console.error("[forgotPassword] Mail error:", mailErr.code, mailErr.message);
      }
    }

    return res.status(200).json({
      success: true,
      message: "If an account exists with this email, an OTP has been sent.",
    });
  } catch (error) {
    console.error("[forgotPassword]", error);
    return res.status(500).json({ success: false, message: "Server error. Please try again." });
  }
}

export async function verifyResetOTP(req, res) {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ success: false, message: "Email and OTP are required." });
    }

    const record = await prisma.passwordResetOTP.findUnique({ where: { email } });

    if (!record) {
      return res.status(404).json({
        success: false,
        message: "No password reset request found. Please start the process again.",
      });
    }

    if (new Date() > new Date(record.otpExpiry)) {
      return res.status(400).json({
        success: false,
        message: "OTP has expired. Please request a new one.",
      });
    }

    if (record.otp !== otp.toString()) {
      return res.status(400).json({ success: false, message: "Invalid OTP. Please try again." });
    }

    return res.status(200).json({
      success: true,
      message: "OTP verified. You may now reset your password.",
    });
  } catch (error) {
    console.error("[verifyResetOTP]", error);
    return res.status(500).json({ success: false, message: "Server error. Please try again." });
  }
}

export async function resetPassword(req, res) {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Email, OTP, and new password are required.",
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters.",
      });
    }

    const record = await prisma.passwordResetOTP.findUnique({ where: { email } });

    if (!record) {
      return res.status(404).json({
        success: false,
        message: "No password reset request found. Please start the process again.",
      });
    }

    if (new Date() > new Date(record.otpExpiry)) {
      return res.status(400).json({ success: false, message: "OTP has expired." });
    }

    if (record.otp !== otp.toString()) {
      return res.status(400).json({ success: false, message: "Invalid OTP." });
    }

    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

    await prisma.user.update({
      where: { email },
      data: { password: hashedPassword },
    });

    await prisma.passwordResetOTP.delete({ where: { email } });

    return res.status(200).json({
      success: true,
      message: "Password reset successfully. You can now sign in.",
    });
  } catch (error) {
    console.error("[resetPassword]", error);
    return res.status(500).json({ success: false, message: "Server error. Please try again." });
  }
}

// GET /api/auth/me 
export async function getMe(req, res) {
  const profileImageSignedUrl = await getAvatarSignedUrl(req.user.profileImage);
  return res.status(200).json({
    success: true,
    user: {
      ...req.user,
      profileImageSignedUrl,
    },
  });
}

// PUT /api/auth/profile  
export async function updateProfile(req, res) {
  try {
    const userId = req.user.id;
    const { name, email, currentRole, targetRole } = req.body;

    if (!name || !email) {
      return res.status(400).json({
        success: false,
        message: "Name and email are required.",
      });
    }

    if (email !== req.user.email) {
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: "An account with this email already exists.",
        });
      }
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        name,
        email,
        currentRole: currentRole || null,
        targetRole: targetRole || null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        location: true,
        currentRole: true,
        experience: true,
        targetRole: true,
        profileImage: true,
      },
    });

    const profileImageSignedUrl = await getAvatarSignedUrl(updated.profileImage);

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully.",
      user: {
        ...updated,
        profileImageSignedUrl,
      },
    });
  } catch (error) {
    console.error("[updateProfile]", error);
    return res.status(500).json({ success: false, message: "Server error. Please try again." });
  }
}

// POST /api/auth/avatar  
export async function uploadAvatar(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No image file uploaded." });
    }

    const userId = req.user.id;
    const timestamp = Date.now();
    const safeName = req.file.originalname.replace(/\s+/g, "_");
    const storagePath = `avatars/${userId}_${timestamp}_${safeName}`;

    // Upload to Supabase Storage
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: true,
      });

    if (error) {
      throw new Error(`Supabase upload failed: ${error.message}`);
    }

    if (req.user.profileImage) {
      await supabase.storage.from(BUCKET).remove([req.user.profileImage]).catch(() => {});
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { profileImage: storagePath },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        location: true,
        currentRole: true,
        experience: true,
        targetRole: true,
        profileImage: true,
      },
    });

    const profileImageSignedUrl = await getAvatarSignedUrl(storagePath);

    return res.status(200).json({
      success: true,
      message: "Profile photo uploaded successfully.",
      user: {
        ...updated,
        profileImageSignedUrl,
      },
    });
  } catch (err) {
    console.error("uploadAvatar error:", err);
    return res.status(500).json({ success: false, message: err.message || "Failed to upload avatar." });
  }
}

// PUT /api/auth/password  
export async function updatePassword(req, res) {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Current password and new password are required.",
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 8 characters.",
      });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: "Incorrect current password." });
    }

    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    return res.status(200).json({
      success: true,
      message: "Password updated successfully.",
    });
  } catch (error) {
    console.error("[updatePassword]", error);
    return res.status(500).json({ success: false, message: "Server error. Please try again." });
  }
}

// DELETE /api/auth/account  
export async function deleteAccount(req, res) {
  try {
    const userId = req.user.id;

    await prisma.user.delete({
      where: { id: userId },
    });

    return res.status(200).json({
      success: true,
      message: "Account deleted successfully.",
    });
  } catch (error) {
    console.error("[deleteAccount]", error);
    return res.status(500).json({ success: false, message: "Server error. Please try again." });
  }
}

let oauthClient;
function getOAuthClient() {
  if (!oauthClient) {
    oauthClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
  }
  return oauthClient;
}

async function verifyGoogleToken(idToken) {
  try {
    const client = getOAuthClient();
    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload) return null;
    return {
      email: payload.email,
      name: payload.name || payload.given_name || "Google User",
      picture: payload.picture,
      email_verified: payload.email_verified === "true" || payload.email_verified === true
    };
  } catch (error) {
    console.error("Google token verification failed:", error.message);
    return null;
  }
}

// POST /api/auth/google
export async function googleLogin(req, res) {
  try {
    const { idToken, signUpIfNotFound = false } = req.body;

    if (!idToken) {
      return res.status(400).json({ success: false, message: "Google ID token is required." });
    }

    // Real Google token verification
    const googleUser = await verifyGoogleToken(idToken);
    if (!googleUser) {
      return res.status(401).json({ success: false, message: "Invalid Google token." });
    }

    const { email, name, picture } = googleUser;

    if (!email) {
      return res.status(400).json({ success: false, message: "Email not provided by Google account." });
    }

    // Check if user exists
    let user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      if (!signUpIfNotFound) {
        return res.status(404).json({
          success: false,
          userExists: false,
          message: "No account found with this Google account."
        });
      }

      // Create user (Signup flow)
      const dummyPassword = Math.random().toString(36).substring(2) + Date.now().toString(36);
      const hashedPassword = await bcrypt.hash(dummyPassword, SALT_ROUNDS);

      user = await prisma.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          role: "CANDIDATE", // default role for google signup
          profileImage: picture || null,
        },
      });
    }

    const token = generateToken({ userId: user.id, email: user.email, role: user.role });
    const profileImageSignedUrl = user.profileImage && user.profileImage.startsWith("http")
      ? user.profileImage
      : await getAvatarSignedUrl(user.profileImage);

    return res.status(200).json({
      success: true,
      message: "Login successful. Welcome back!",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        location: user.location,
        currentRole: user.currentRole,
        experience: user.experience,
        targetRole: user.targetRole,
        profileImage: user.profileImage,
        profileImageSignedUrl,
      },
    });

  } catch (error) {
    console.error("[googleLogin]", error);
    return res.status(500).json({ success: false, message: "Server error. Please try again." });
  }
}

