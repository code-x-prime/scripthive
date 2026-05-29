import multer from "multer";
import path from "path";
import fs from "node:fs";

const pdfFilter: multer.Options["fileFilter"] = (_req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (file.mimetype === "application/pdf" && ext === ".pdf") { cb(null, true); return; }
  cb(new Error("Only PDF files allowed"));
};

const docFilter: multer.Options["fileFilter"] = (_req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const allowed = [".pdf", ".doc", ".docx"];
  const allowedMime = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ];
  if (allowed.includes(ext) && allowedMime.includes(file.mimetype)) { cb(null, true); return; }
  cb(new Error("Only PDF or Word files allowed"));
};

// manuscripts — accepts PDF, DOC, DOCX; caller renames to submissionId after DB record created
export const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      fs.mkdirSync("uploads/manuscripts", { recursive: true });
      cb(null, "uploads/manuscripts");
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || ".pdf";
      cb(null, `tmp_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`);
    }
  }),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: docFilter
});

// production upload stage — PDF or Word, auto-named by submissionId
export const uploadProduction = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      fs.mkdirSync("uploads/production", { recursive: true });
      cb(null, "uploads/production");
    },
    filename: (_req, _file, cb) => {
      cb(null, `tmp_${Date.now()}_${Math.random().toString(36).slice(2)}`);
    }
  }),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: docFilter
});

// published article PDFs
export const uploadArticle = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      fs.mkdirSync("uploads/articles", { recursive: true });
      cb(null, "uploads/articles");
    },
    filename: (_req, _file, cb) => {
      cb(null, `tmp_${Date.now()}_${Math.random().toString(36).slice(2)}.pdf`);
    }
  }),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: pdfFilter
});
