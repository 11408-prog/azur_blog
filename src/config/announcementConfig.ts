import type { AnnouncementConfig } from "../types/config";

// 公告栏配置
export const announcementConfig: AnnouncementConfig = {
	title: "", // 公告标题，填空使用i18n字符串Key.announcement
	content: "", // 公告内容
	closable: true, // 允许用户关闭公告
	link: {
		enable: false, // 关闭链接：原本跳 /about/，与头像点击目标撞车
		text: "Learn More", // 链接文本
		url: "/about/", // 链接 URL
		external: false, // 内部链接
	},
};
