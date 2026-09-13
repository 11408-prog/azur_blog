---
title: Make Identity Indistinguishable 部分实验复现复盘
date: 2026-09-13 16:26:04
tags: [差分隐私,Metric-DP, 实验复现]
categories: 学习
mathjax: true
---

# Make Identity Indistinguishable 实验复现复盘

## 1. 复现目标

复现论文《Make Identity Indistinguishable: Utility-Preserving Face Dataset Publication with Provable Privacy Guarantees》的核心机制，验证 Metric-DP 在保护人脸隐私的同时保留身份相关性的能力。

最终目标：完成 Stage I（特征提取 + PCA）和 Stage II（Metric-DP 加噪），并与 Pix-DP、SVD-DP 进行对比。

## 2. 整体流程

数据准备 → 环境搭建 → Stage I → Stage II → 评估对比

## 3. 数据准备

数据集：CelebA，包含 10,177 个身份、20 万+ 张图像。

解析文件：`identity_CelebA.txt` 和 `list_attr_celeba.txt`。

筛选条件：每个身份至少有 20 张图，共得到 6,348 个有效身份。

数据划分：

- 公开集：400 个身份 × 20 张 = 8,000 张。
- 受保护集：25 个身份 × 20 张 = 500 张。
- 两组身份不重叠。

关键决策：初期使用 25 个公开身份 × 5 张 = 125 张图，导致 PCA 协方差矩阵奇异、Lambda 被高估、噪声过大；后扩大到 400 身份 × 20 张，PCA 恢复稳定。

## 4. 环境搭建

| 问题 | 原因 | 解决方案 |
| --- | --- | --- |
| NumPy 2.0.2 与 matplotlib 冲突 | 模块用 NumPy 1.x 编译 | 降级到 NumPy 1.26.4 |
| torchmetrics 导入失败 | 同上 | 降级 NumPy 后解决 |
| facenet_pytorch、lpips 未安装 | 缺少包 | `pip install facenet-pytorch lpips` |
| 降级命令装到了 base 环境 | `!pip` 指向错误 | 用 `{sys.executable} -m pip` |
| 新建 Notebook 后 NumPy 又变回 2.x | 新 Kernel 环境不同 | 用 conda 在 `dp-env` 环境降级 |
| insightface / diffusers 依赖冲突 | 需要 NumPy ≥2 | 创建独立 `ipadapter` 环境 |

最终环境：conda 环境 `dp-env`，Python 3.10，NumPy 1.26.4，PyTorch 2.x，torchvision，torchmetrics，facenet-pytorch，lpips，opencv，scikit-learn，matplotlib。

## 5. Stage I：特征提取与 PCA

### 5.1 特征提取

身份特征：用 FaceNet（vggface2 权重）提取 512 维身份向量。

输入：256×256 图像，resize 到 160×160。

预处理：`(x - 0.5) / 0.5` 归一化到 `[-1, 1]`。

属性特征：使用 CelebA 的 40 维二值属性向量。

拼接 + L2 归一化：

```python
c_id = c_id / np.linalg.norm(c_id)  # L2 归一化
c = np.concatenate([c_id, attr], axis=0)  # 512 + 40 = 552
```

### 5.2 PCA 训练

只在公开集（8,000 张图）上训练。

取前 K=40 个主成分。

累计解释方差：98.4%。

Lambda 范围：0.036 ~ 4.22，均值 0.54。

```python
K = 40
pca = PCA(n_components=K)
pca.fit(public_features)
Lambda = pca.explained_variance_
z_private = pca.transform(private_features)
```

### 5.3 可视化验证

受保护集 3 个身份在 PC1-PC2 平面形成独立簇。

复现了论文图 4。

关键洞察：

- L2 归一化至关重要：否则 FaceNet 向量数值过大，PCA 方差被高估。
- 样本数必须远大于特征维度：8000 ≫ 552，PCA 才稳定。

## 6. Stage II：Metric-DP 加噪

### 6.1 理论依据

论文设计的采样概率密度：

$$
P_{\epsilon,k}(x_0)(x)=C_{\epsilon,k}\cdot e^{-\epsilon\cdot d_X(x_0,x)}
$$

其中 \(d_X\) 是 Mahalanobis 距离，协方差矩阵为 PCA 的 `explained_variance_`。

### 6.2 采样实现

径向：

$$
r \sim \mathrm{Gamma}(k,\ \mathrm{rate}=\epsilon)
$$

方向 \(v\) 均匀分布在单位 \((k-1)\)-球面。

变换回 PCA 空间：

$$
z_{\text{noisy}} = z_0 + \sqrt{\Lambda}\cdot(r\cdot v)
$$

```python
from scipy.stats import gamma

def sample_metric_dp(z0, Lambda, eps):
    k = len(z0)
    r = gamma.rvs(a=k, scale=1.0 / eps)
    v = np.random.randn(k)
    v = v / np.linalg.norm(v)
    return z0 + np.sqrt(Lambda) * (r * v)

def ours_obfuscate(features, pca, Lambda, eps):
    z = pca.transform(features)
    z_noisy = np.stack([sample_metric_dp(z[i], Lambda, eps) for i in range(len(z))])
    return pca.inverse_transform(z_noisy)
```

### 6.3 实验结果

| ε | 同人相似度 | 异人相似度 |
| ---: | ---: | ---: |
| 0.1 | 0.0005 | -0.0007 |
| 0.5 | 0.0051 | 0.0017 |
| 1.0 | 0.0187 | 0.0090 |
| 5.0 | 0.3070 | 0.1174 |
| 10.0 | 0.5226 | 0.2153 |

结论：

- ε 增大 → 噪声减小 → 同人相似度上升。
- 同人始终高于异人，说明身份相关性被保留。
- 趋势与论文 Table 3 一致。

## 7. 对比方法

Pix-DP：分块均值 + 拉普拉斯噪声 + 上采样。

```python
def pix_dp(img, b=6, epsilon=1.0):
    img_block = img.reshape(C, H // b, b, W // b, b).mean(axis=(2, 4))
    noise = np.random.laplace(0, 1 / (b * b * epsilon), img_block.shape)
    return np.repeat(np.repeat(img_block + noise, b, 1), b, 2)
```

SVD-DP：逐通道 SVD + 奇异值加噪。

```python
def svd_dp(img, epsilon=1.0):
    for c in range(3):
        U, S, Vt = np.linalg.svd(img[:, :, c])
        S_noisy = S + np.random.laplace(0, 1 / epsilon, S.shape)
        out.append(U @ np.diag(S_noisy) @ Vt)
```

## 8. 关键问题与解决

| 问题 | 原因 | 解决方案 |
| --- | --- | --- |
| PCA 散点图重叠 | 25 个身份太多，二维不够 | 只画 3 个身份，复现图 4 |
| 图例遮挡散点 | 默认位置在右上 | `bbox_to_anchor=(1.02, 0.5)` |
| 小样本 PCA 崩溃 | 125 < 552 维 | 扩到 8000 样本 |
| ε=1 相似度暴跌 | 噪声长度 40 ≫ 特征长度 4.6 | 无法完全解决，需 Stage III |
| NumPy 反复冲突 | 多环境混用 | conda 环境隔离 |
| 新 Notebook 变量未定义 | Kernel 独立 | 保存 `.npy` 文件跨 Notebook 传递 |

## 9. 与论文对比

| 内容 | 论文 | 复现 | 差距原因 |
| --- | --- | --- | --- |
| Stage I | ✅ | ✅ 完成 | 一致 |
| Stage II | ✅ | ✅ 完成 | 一致 |
| Stage III | ✅ 扩散模型 | ❌ 未完成 | 算力 + 环境 |
| ε=1 同人相似度 | 0.288 | 0.019 | 缺 Stage III 生成补全 |
| 趋势 | ε↑ → 相似度↑ | ✅ 一致 | 机制正确 |
| 身份相关性保留 | ✅ | ✅ 同人 > 异人 | 一致 |

## 10. 经验总结

### 做得好的地方

- 理解了论文核心：Metric-DP 的本质是在 Mahalanobis 距离下采样指数分布，而不是简单加高斯噪声。
- 坚持验证趋势：即使绝对值有差距，趋势正确就说明机制正确。
- 解决了真实工程问题：环境冲突、内存优化、跨 Notebook 数据传递。
- 可视化复现：图 4 与论文高度一致。

### 可以改进的地方

- 环境管理：应该一开始就用独立 conda 环境，避免反复冲突。
- 数据规模：早期样本太小导致 PCA 病态，应该一开始就用 400 身份。
- 对比方法：Pix-DP / SVD-DP 的对比表还未系统完成。
- Stage III：可以更早评估算力，决定是否走路线 C。

## 11. 当前状态

| 模块 | 状态 |
| --- | --- |
| 数据准备 | ✅ 完成 |
| 环境搭建 | ✅ 完成 |
| Stage I | ✅ 完成 |
| Stage II | ✅ 完成 |
| Pix-DP / SVD-DP | ⏳ 部分完成 |
| Stage III（路线 C） | ⏳ 环境配置中 |
| 对比表 | ⏳ 待补完 |
| 报告 | ⏳ 待写 |

## 12. 下一步建议

优先补完对比表：Pix-DP、SVD-DP、Ours 在 ε=0.1, 1, 10 下的身份相似度、SSIM、PSNR。

画趋势图：ε 为横轴，三条曲线对比。

Stage III：如果一天内搞不定，在报告中说明原因。

写报告：现有材料已经足够支撑一份完整的复现报告。

## Q&A

### 为什么 ε=1 时同人相似度只有 0.019，论文却是 0.288？

因为复现只完成了 Stage I + Stage II，论文的 Stage III 扩散模型会对加噪特征进行“生成补全”，即使输入特征被噪声污染，生成图像仍可能保留部分原始身份。当前测的是纯特征空间相似度，因此绝对值偏低。

### 为什么异人相似度会出现负数？

余弦相似度范围是 `[-1, 1]`。在 512 维空间中，两个随机向量近似正交，期望为 0，标准差约为 \(1/\sqrt{512}\approx 0.044\)。因此 -0.0007 之类的负数就是 0 附近的随机波动，没有特殊含义。

### 为什么小样本会导致 PCA 崩溃？

PCA 需要估计 552×552 的协方差矩阵。当样本数只有 125 时，远小于维度 552，协方差矩阵奇异，特征值被高估或混乱，导致 Lambda 异常，噪声被过度放大。

### Metric-DP 和普通高斯/拉普拉斯 DP 有什么区别？

Metric-DP 使用 Mahalanobis 距离定义隐私，采样分布为

$$
P(x)\propto e^{-\epsilon d_X(x_0,x)}
$$

径向服从 Gamma 分布，方向在单位球面均匀。普通 DP 直接对每个维度独立加噪，忽略特征间的相关性。

## 词汇表

| 术语 | 说明 |
| --- | --- |
| Stage I | 特征提取与 PCA 降维 |
| Stage II | Metric-DP 特征加噪 |
| Stage III | 条件扩散模型生成保护图像 |
| Metric-DP | 基于距离度量的差分隐私 |
| Mahalanobis 距离 | 考虑协方差结构的距离度量 |
| Lambda | PCA 各主成分的解释方差 |
| 同人相似度 | 同一身份不同图像之间的余弦相似度 |
| 异人相似度 | 不同身份图像之间的余弦相似度 |
| Pix-DP | 像素化 + 拉普拉斯噪声的隐私保护方法 |
| SVD-DP | 奇异值分解 + 噪声的隐私保护方法 |