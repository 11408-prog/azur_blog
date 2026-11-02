import type { Song } from "./types";
import { LOCAL_PLAYLIST_GENERATED as RAW_PLAYLIST } from "./localPlaylist.generated";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

// 把写死的绝对路径（/music/...、/favicon/...）统一加上 base 前缀。
// url 和 cover 都要处理：只给 url 加会导致封面在子路径部署时 404。
function withBase(url: string): string {
	if (!url || !url.startsWith("/")) return url;
	if (url.startsWith("//")) return url;
	if (BASE === "") return url;
	if (url === BASE || url.startsWith(`${BASE}/`)) return url;
	return BASE + url;
}

export const LOCAL_PLAYLIST: Song[] = RAW_PLAYLIST.map((song) => ({
	...song,
	url: withBase(song.url),
	cover: withBase(song.cover),
}));

export const STORAGE_KEY_VOLUME = "music-player-volume";

export const DEFAULT_VOLUME = 0.7;

// 给默认封面也加上 base 前缀
export const DEFAULT_COVER_URL = `${BASE}/favicon/favicon.ico`;

// 🔴 删除了原先未定义且冲突的 LOCAL_PLAYLIST_GENERATED 导出

export const DEFAULT_SONG: Song = {
	title: "Sample Song",
	artist: "Sample Artist",
	cover: DEFAULT_COVER_URL,
	url: "",
	duration: 0,
	id: 0,
};

export const DEFAULT_METING_API =
	"https://www.bilibili.uno/api?server=:server&type=:type&id=:id&auth=:auth&r=:r";
export const DEFAULT_METING_ID = "14164869977";
export const DEFAULT_METING_SERVER = "netease";
export const DEFAULT_METING_TYPE = "playlist";

export const ERROR_DISPLAY_DURATION = 3000;
export const SKIP_ERROR_DELAY = 1000;