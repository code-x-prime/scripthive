import { parseApiError } from "@/utils/parseApiError";

export interface MediaFileRecord {
  id: string;
  originalName: string;
  storedName: string;
  mimeType: string;
  size: number;
  url: string;
  createdAt: string;
  uploadedBy?: { id: string; name: string } | null;
}

type TokenGetter = () => string | null;

let getToken: TokenGetter = () => null;

export function setMediaTokenGetter(fn: TokenGetter): void {
  getToken = fn;
}

export async function listMediaFiles(): Promise<MediaFileRecord[]> {
  const token = getToken();
  const res = await fetch("/api/media", {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: "include"
  });
  if (!res.ok) throw new Error(await parseApiError(res, "Could not load media library"));
  return (await res.json()) as MediaFileRecord[];
}

export function uploadMediaFile(
  file: File,
  onProgress: (percent: number) => void
): Promise<MediaFileRecord[]> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const fd = new FormData();
    fd.append("files", file);

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) {
        onProgress(Math.min(100, Math.round((e.loaded / e.total) * 100)));
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const body = JSON.parse(xhr.responseText) as { files: MediaFileRecord[] };
          resolve(body.files ?? []);
        } catch {
          reject(new Error("Invalid server response"));
        }
        return;
      }
      try {
        const err = JSON.parse(xhr.responseText) as { message?: string };
        reject(new Error(err.message ?? "Upload failed"));
      } catch {
        reject(new Error("Upload failed"));
      }
    });

    xhr.addEventListener("error", () => reject(new Error("Network error during upload")));
    xhr.addEventListener("abort", () => reject(new Error("Upload cancelled")));

    xhr.open("POST", "/api/media/upload");
    const token = getToken();
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.withCredentials = true;
    xhr.send(fd);
  });
}

export async function deleteMediaFile(id: string): Promise<void> {
  const token = getToken();
  const res = await fetch(`/api/media/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: "include"
  });
  if (!res.ok) throw new Error(await parseApiError(res, "Delete failed"));
}
