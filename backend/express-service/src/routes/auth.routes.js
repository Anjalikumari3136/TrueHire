import { Router } from "express";
import multer from "multer";
import {
  signup,
  verifyOTP,
  resendOTP,
  login,
  forgotPassword,
  verifyResetOTP,
  resetPassword,
  getMe,
  updateProfile,
  updatePassword,
  deleteAccount,
  uploadAvatar,
  googleLogin,
} from "../controllers/auth.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB max
  fileFilter: (_req, file, cb) => {
    if (["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPEG, PNG and WEBP images are allowed."), false);
    }
  },
});

router.post("/signup", signup);
router.post("/verify-otp", verifyOTP);
router.post("/resend-otp", resendOTP);
router.post("/login", login);
router.post("/google", googleLogin);
router.post("/forgot-password", forgotPassword);
router.post("/verify-reset-otp", verifyResetOTP);
router.post("/reset-password", resetPassword);


router.get("/me", authenticate, getMe);
router.put("/profile", authenticate, updateProfile);
router.put("/password", authenticate, updatePassword);
router.delete("/account", authenticate, deleteAccount);
router.post("/avatar", authenticate, upload.single("avatar"), uploadAvatar);

export default router;
