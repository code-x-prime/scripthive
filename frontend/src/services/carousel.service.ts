import { parseApiError } from "@/utils/parseApiError";

export interface CarouselSlide {
  id: string;
  imageUrl: string;
  title: string | null;
  subtitle: string | null;
  linkUrl: string | null;
  position: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

type TokenGetter = () => string | null;
let getToken: TokenGetter = () => null;

export function setCarouselTokenGetter(fn: TokenGetter): void {
  getToken = fn;
}

function authHeaders(): HeadersInit {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function listCarouselSlidesAdmin(): Promise<CarouselSlide[]> {
  const res = await fetch("/api/carousel", {
    headers: authHeaders(),
    credentials: "include"
  });
  if (!res.ok) throw new Error(await parseApiError(res, "Could not load slides"));
  return (await res.json()) as CarouselSlide[];
}

export async function listCarouselSlidesPublic(): Promise<CarouselSlide[]> {
  const res = await fetch("/api/carousel/public");
  if (!res.ok) return [];
  return (await res.json()) as CarouselSlide[];
}

export async function createCarouselSlide(
  data: Omit<CarouselSlide, "id" | "createdAt" | "updatedAt">
): Promise<CarouselSlide> {
  const res = await fetch("/api/carousel", {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error(await parseApiError(res, "Could not create slide"));
  return (await res.json()) as CarouselSlide;
}

export async function updateCarouselSlide(
  id: string,
  data: Partial<Omit<CarouselSlide, "id" | "createdAt" | "updatedAt">>
): Promise<CarouselSlide> {
  const res = await fetch(`/api/carousel/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error(await parseApiError(res, "Could not update slide"));
  return (await res.json()) as CarouselSlide;
}

export async function reorderCarouselSlides(order: string[]): Promise<void> {
  const res = await fetch("/api/carousel/reorder", {
    method: "PUT",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ order })
  });
  if (!res.ok) throw new Error(await parseApiError(res, "Could not reorder slides"));
}

export async function deleteCarouselSlide(id: string): Promise<void> {
  const res = await fetch(`/api/carousel/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: authHeaders(),
    credentials: "include"
  });
  if (!res.ok) throw new Error(await parseApiError(res, "Could not delete slide"));
}
