import type { AdminUser } from "@/types";

type Handlers = {
  setAccessToken: (t: string | null) => void;
  setAdmin: (a: AdminUser | null) => void;
};

let handlers: Partial<Handlers> = {};

export function registerAuthTokenBridge(h: Partial<Handlers>): void {
  handlers = h;
}

export function applyRefreshedSession(accessToken: string, admin?: AdminUser | null): void {
  handlers.setAccessToken?.(accessToken);
  if (admin !== undefined) handlers.setAdmin?.(admin);
}
