import type { ProfileConfig } from "../types/config";
import { withBase } from "./siteConfig";

// 个人资料配置
export const profileConfig: ProfileConfig = {
	avatar: "/img/avatar.png",// 相对于 /src 目录。如果以 '/' 开头，则相对于 /public 目录
	name: "灰色幽灵",
	bio: "遇事不能坐以待毙",
	typewriter: {
		enable: true, // 启用个人简介打字机效果
		speed: 80, // 打字速度（毫秒）
	},
	links: [
		{
			name: "Bilibili",
			icon: "fa7-brands:bilibili",
			url: "https://space.bilibili.com/1376082770",
		},
		{
			name: "酷狗概念版",
			icon: "fa7-solid:music", // simple-icons 未收录 kugou，用音符图标代替
			// 酷狗个人主页只在 App 内存在，无公开外链，故指向分享出来的歌单；酷狗 ID: 2586463630
			url: "https://t1.kugou.com/lTTt14G7V2",
		},
		{
			name: "GitHub",
			icon: "fa7-brands:github",
			url: "https://github.com/11408-prog",
		},
		{
			name: "QQ",
			icon: "fa7-brands:qq",
			url: "https://qm.qq.com/q/wzkCnXSCiI", // QQ 官方加好友名片链接
		},
		{
			name: "抖音",
			icon: "simple-icons:tiktok", // simple-icons 未收录 douyin，用同款 TikTok 图标
			// 由分享短链 v.douyin.com/pPD0UUwPR8c/ 解析出的 sec_uid；抖音号 68056713326
			url: "https://www.douyin.com/user/MS4wLjABAAAApNTah2jj8coM9gDzdk0a54iAYUJpxUJtHqqDkUQivLY",
		},
	],
};
