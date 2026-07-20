// 서버 위젯 — 개인 즐겨찾기(페이지 북마크) + 즐겨찾기 거래처를 모아 넘긴다.
import { listUserFavorites } from "@/server/repositories/user-favorite";
import { quickAccessFavorites } from "@/server/repositories/search";
import { FavoritesPad } from "@/components/dashboard/FavoritesPad";
import type { CurrentUser } from "@/server/session";

export async function FavoritesWidget({ user }: { user: CurrentUser }) {
  const [favorites, clientFavs] = await Promise.all([
    listUserFavorites(user.id).catch(() => []),
    quickAccessFavorites(user).catch(() => [])
  ]);
  return <FavoritesPad favorites={favorites} clientFavorites={clientFavs.map((c) => ({ title: c.title, href: c.href }))} />;
}
