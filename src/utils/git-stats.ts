import { execFileSync } from "node:child_process";

let cachedCommitCount: number | null | undefined;

function runGit(args: string[]): string {
	return execFileSync("git", args, {
		encoding: "utf8",
		stdio: ["ignore", "pipe", "ignore"],
		timeout: 5000,
	}).trim();
}

/**
 * 获取当前仓库的提交总数（构建时读取一次，之后复用结果）。
 *
 * 返回 null 表示"没法给出可信的数字"，调用方应当隐藏这一项而不是显示 0：
 * - 不在 git 仓库里（例如下载的 zip）、或者没有安装 git
 * - 浅克隆（shallow clone）：只拿到了部分历史，数出来的数字是错的
 *
 * 注意：它统计的是构建那一刻 HEAD 之前的提交。auto-deploy 是先构建、再提交源码，
 * 所以线上显示的数字会比实际少最近那一次提交，属于正常现象。
 */
export function getCommitCount(): number | null {
	if (cachedCommitCount !== undefined) {
		return cachedCommitCount;
	}

	try {
		if (runGit(["rev-parse", "--is-shallow-repository"]) === "true") {
			cachedCommitCount = null;
			return cachedCommitCount;
		}
		const count = Number.parseInt(runGit(["rev-list", "--count", "HEAD"]), 10);
		cachedCommitCount = Number.isFinite(count) && count > 0 ? count : null;
	} catch {
		cachedCommitCount = null;
	}
	return cachedCommitCount;
}
