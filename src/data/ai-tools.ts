export type AIToolCategory =
	| "chat"
	| "coding"
	| "image"
	| "audio"
	| "video"
	| "writing"
	| "search"
	| "other";

export type AIToolFrequency =
	| "daily"
	| "weekly"
	| "occasional"
	| "experimental";

export type LocaleString = Partial<
	Record<"en" | "zh_CN" | "zh_TW" | "ja", string>
>;

export function getLocaleString(value: LocaleString, lang: string): string {
	return value[lang as keyof LocaleString] ?? value["en"] ?? "";
}

export interface AITool {
	id: string;
	name: string;
	description: LocaleString;
	icon: string;
	category: AIToolCategory;
	frequency: AIToolFrequency;
	url?: string;
	usage?: LocaleString;
	tags?: string[];
	color?: string;
}

// Replace the examples below with your own AI tools
export const aiToolsData: AITool[] = [
	{
		id: "deepseek",
		name: "DeepSeek",
		description: {
			zh_CN: "国产 AI 助手，中文表达与代码能力强，性价比高",
			en: "Chinese AI assistant, strong at Chinese writing and coding",
		},
		icon: "simple-icons:deepseek",
		category: "chat",
		frequency: "daily",
		url: "https://chat.deepseek.com",
		usage: {
			zh_CN: "日常问答、代码调试、思路梳理",
		},
		tags: ["对话", "推理", "代码"],
		color: "#4D6BFE",
	},
	{
		id: "chatgpt",
		name: "ChatGPT",
		description: {
			zh_CN: "通用对话助手，生态与插件最丰富",
			en: "General-purpose assistant with the richest ecosystem",
		},
		icon: "simple-icons:openai",
		category: "chat",
		frequency: "weekly",
		url: "https://chatgpt.com",
		usage: {
			zh_CN: "多模态任务、资料检索、写作润色",
		},
		tags: ["对话", "多模态"],
		color: "#10A37F",
	},
	{
		id: "claude",
		name: "Claude",
		description: {
			zh_CN: "长文本与代码理解出色，适合读文档和写复杂逻辑",
			en: "Excellent at long context and coding",
		},
		icon: "simple-icons:claude",
		category: "chat",
		frequency: "weekly",
		url: "https://claude.ai",
		usage: {
			zh_CN: "长文档阅读、复杂逻辑与重构",
		},
		tags: ["对话", "长文本", "代码"],
		color: "#D97757",
	},
	{
		id: "deepseek-harness",
		name: "DeepSeek Harness",
		description: {
			zh_CN: "DeepSeek 开源的 Agent 运行时框架，一切皆插件，支持接入多种模型",
			en: "Open-source agent runtime from DeepSeek, plugin-based and model-agnostic",
		},
		icon: "simple-icons:deepseek",
		category: "coding",
		frequency: "weekly",
		url: "https://www.deepseek.com/zh/harness/",
		usage: {
			zh_CN: "跑 Agent 任务、改仓库、装插件扩展能力",
		},
		tags: ["Agent", "插件", "编码"],
		color: "#4D6BFE",
	},
];
