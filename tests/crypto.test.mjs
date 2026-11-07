/**
 * 加密系统端到端测试
 * 运行方式: node --experimental-strip-types tests/crypto.test.mjs
 * 无需任何测试框架依赖
 *
 * 服务端加密直接导入真实的 src/utils/crypto-utils.ts，
 * 这样修改加密实现时测试会同步失败，而不是测一份过期的拷贝。
 * 客户端解密对应 PasswordProtection.astro 里的内联脚本，
 * 常量同样取自 CRYPTO_CONSTANTS（页面里也是通过 define:vars 取的）。
 */
import { CRYPTO_CONSTANTS, encryptContent } from "../src/utils/crypto-utils.ts";

// === 客户端解密（复刻 PasswordProtection.astro inline script） ===
async function clientDecrypt(encData, password) {
	const { PBKDF2_ITERATIONS, SALT_LENGTH, IV_LENGTH, AUTH_TAG_LENGTH, VERIFY_PREFIX } = CRYPTO_CONSTANTS;
	const raw = Buffer.from(encData, "base64");
	const salt = raw.subarray(0, SALT_LENGTH);
	const iv = raw.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
	const authTag = raw.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);
	const ciphertext = raw.subarray(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);

	const combined = Buffer.concat([ciphertext, authTag]);

	const enc = new TextEncoder();
	const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
	const aesKey = await crypto.subtle.deriveKey(
		{ name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
		keyMaterial, { name: "AES-GCM", length: 256 }, false, ["decrypt"],
	);
	const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, aesKey, combined);
	const decoded = new TextDecoder().decode(decrypted);

	if (!decoded.startsWith(VERIFY_PREFIX)) {
		throw new Error("Verification prefix mismatch");
	}
	return decoded.substring(VERIFY_PREFIX.length);
}

// === 测试用例 ===
const testHtml = "<h1>Hello World</h1><p>这是一篇加密文章的内容</p>";
const testPassword = "test-password-123";

let passed = 0;
let failed = 0;

function assert(condition, message) {
	if (!condition) throw new Error(`Assertion failed: ${message}`);
}

async function test(name, fn) {
	try {
		await fn();
		console.log(`  ✓ ${name}`);
		passed++;
	} catch (err) {
		console.log(`  ✗ ${name}`);
		console.log(`    ${err.message}`);
		failed++;
	}
}

console.log("Encryption System Tests\n");

await test("encrypt and decrypt with correct password", async () => {
	const encrypted = encryptContent(testHtml, testPassword);
	assert(encrypted.length > 0, "ciphertext should not be empty");
	const decrypted = await clientDecrypt(encrypted, testPassword);
	assert(decrypted === testHtml, `decrypted content mismatch: got "${decrypted.slice(0, 30)}..."`);
});

await test("ciphertext is randomized for same inputs", () => {
	const a = encryptContent(testHtml, testPassword);
	const b = encryptContent(testHtml, testPassword);
	assert(a !== b, "same inputs must NOT produce the same ciphertext");
	const rawA = Buffer.from(a, "base64");
	const rawB = Buffer.from(b, "base64");
	const { SALT_LENGTH, IV_LENGTH } = CRYPTO_CONSTANTS;
	assert(
		!rawA.subarray(0, SALT_LENGTH).equals(rawB.subarray(0, SALT_LENGTH)),
		"salt must be random",
	);
	assert(
		!rawA
			.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH)
			.equals(rawB.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH)),
		"IV must be random (reusing an IV breaks AES-GCM)",
	);
});

await test("editing a post never reuses the key/IV pair", () => {
	const { SALT_LENGTH, IV_LENGTH } = CRYPTO_CONSTANTS;
	const seen = new Set();
	for (let i = 0; i < 20; i++) {
		const raw = Buffer.from(
			encryptContent(`<p>version ${i}</p>`, testPassword),
			"base64",
		);
		seen.add(raw.subarray(0, SALT_LENGTH + IV_LENGTH).toString("hex"));
	}
	assert(seen.size === 20, "salt+IV must be unique for every encryption");
});

await test("reject wrong password", async () => {
	const encrypted = encryptContent(testHtml, testPassword);
	let threw = false;
	try {
		await clientDecrypt(encrypted, "wrong-password");
	} catch {
		threw = true;
	}
	assert(threw, "wrong password should throw");
});

await test("reject tampered ciphertext", async () => {
	const raw = Buffer.from(encryptContent(testHtml, testPassword), "base64");
	raw[raw.length - 1] ^= 0x01;
	let threw = false;
	try {
		await clientDecrypt(raw.toString("base64"), testPassword);
	} catch {
		threw = true;
	}
	assert(threw, "tampered ciphertext should fail GCM authentication");
});

await test("CJK content round-trip", async () => {
	const cjk = "<p>日本語テスト 中文测试 한국어 테스트</p>";
	const encrypted = encryptContent(cjk, testPassword);
	const decrypted = await clientDecrypt(encrypted, testPassword);
	assert(decrypted === cjk, "CJK content mismatch");
});

await test("empty content round-trip", async () => {
	const encrypted = encryptContent("", testPassword);
	const decrypted = await clientDecrypt(encrypted, testPassword);
	assert(decrypted === "", "empty content mismatch");
});

await test("special HTML characters round-trip", async () => {
	const special = '<div class="test">&amp; &lt; &gt; "quotes" \'single\'</div>';
	const encrypted = encryptContent(special, testPassword);
	const decrypted = await clientDecrypt(encrypted, testPassword);
	assert(decrypted === special, "special HTML mismatch");
});

await test("CRYPTO_CONSTANTS have required fields", () => {
	assert(CRYPTO_CONSTANTS.PBKDF2_ITERATIONS >= 600000, "PBKDF2_ITERATIONS should be >= 600000");
	assert(CRYPTO_CONSTANTS.SALT_LENGTH === 16, "SALT_LENGTH");
	assert(CRYPTO_CONSTANTS.IV_LENGTH === 12, "IV_LENGTH");
	assert(CRYPTO_CONSTANTS.AUTH_TAG_LENGTH === 16, "AUTH_TAG_LENGTH");
	assert(CRYPTO_CONSTANTS.KEY_LENGTH === 32, "KEY_LENGTH");
	assert(CRYPTO_CONSTANTS.VERIFY_PREFIX === "MIZUKI-VERIFY:", "VERIFY_PREFIX");
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
