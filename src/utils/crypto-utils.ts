import { createCipheriv, pbkdf2Sync, randomBytes } from "node:crypto";

// 共享加密常量 — 客户端解密脚本（PasswordProtection.astro）通过 define:vars
// 直接使用这里的值，不需要再手动同步。
export const CRYPTO_CONSTANTS = {
	// OWASP 对 PBKDF2-HMAC-SHA256 的建议值约为 60 万次。
	// 加密页面是公开的静态文件，攻击者可以离线无限次尝试，迭代次数越高越安全。
	PBKDF2_ITERATIONS: 600000,
	SALT_LENGTH: 16,
	IV_LENGTH: 12,
	AUTH_TAG_LENGTH: 16,
	KEY_LENGTH: 32,
	VERIFY_PREFIX: "MIZUKI-VERIFY:", // 验证前缀：正确解密后内容以此开头
} as const;

/**
 * 加密 HTML 内容
 *
 * 协议 v3：每次加密都使用随机的 salt 和 IV。
 * 旧版本用 HMAC(password, slug) 确定性地派生 salt 和 IV，
 * 文章修改后重新构建会用同一个密钥和 IV 加密不同的明文，
 * 这在 AES-GCM 下会泄露明文信息并允许伪造密文，所以必须随机化。
 *
 * 输出格式：base64(salt[16] + iv[12] + authTag[16] + ciphertext)
 * 其中 ciphertext = AES-256-GCM-encrypt("MIZUKI-VERIFY:" + html)
 *
 * 随机化之后同一篇文章每次构建的密文都不同，属于预期行为。
 */
export function encryptContent(html: string, password: string): string {
	const {
		PBKDF2_ITERATIONS,
		SALT_LENGTH,
		IV_LENGTH,
		KEY_LENGTH,
		VERIFY_PREFIX,
	} = CRYPTO_CONSTANTS;

	const plaintext = VERIFY_PREFIX + html;

	const salt = randomBytes(SALT_LENGTH);
	const iv = randomBytes(IV_LENGTH);
	const key = pbkdf2Sync(
		password,
		salt,
		PBKDF2_ITERATIONS,
		KEY_LENGTH,
		"sha256",
	);

	const cipher = createCipheriv("aes-256-gcm", key, iv);
	const encrypted = Buffer.concat([
		cipher.update(plaintext, "utf8"),
		cipher.final(),
	]);
	const authTag = cipher.getAuthTag();

	return Buffer.concat([salt, iv, authTag, encrypted]).toString("base64");
}
