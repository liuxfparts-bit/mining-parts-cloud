# SRC-02 证据归档与比对报告

## 结论

针对负责人提交的324个文件指纹：323项与固定候选 b3fee86fab79eecf21ec1ac33ddba2f5247a263b 匹配；1项为已知CI差异。此结论只覆盖返回路径，不能视为完整生产V7、完整容器或可复现构建验收。

## 证据来源

原附件：Pasted text(5).txt。原始字节SHA256：0bb23bf983aa0444554a3f3c3d51bb3abebf4ba9450b0e1b182086f56a7c03e0。
原文按原始字节归档为owner-transcript.txt，不修改终端填充或换行。
取证时间按BEGIN：2026-10-30T10:58:35.797735+00:00（北京时间2026-10-30 18:58:35）。
服务器目录：/home/ubuntu/kpy-entry-home-20261029-085011。
有BEGIN、CONTAINER、324个唯一FILE记录及COMPLETE；无FAILED。
附件未包含运行前脚本sha256sum回执，因此不宣称独立证明实际执行脚本字节版本。服务器执行由负责人完成，AI未连接服务器。

## 派生解析规则

终端复制在JSON键和值内部插入连续空格。对以左花括号开始的记录行，移除10个及以上连续ASCII空格，再进行JSON解析。原始附件完整保留；records-normalized.json为本次生成的派生证据，不冒充服务器原始JSON。comparison.json记录受影响行号与匹配路径。

## 比对方式

315项通过本地实际SHA256、大小与候选清单Git blob ID交叉核对；其余8个迁移文件从固定候选Git blob读取并计算SHA256和大小后匹配。CI也从固定候选Git blob读取核对。
文件SHA256与Git blob SHA-1明确区分。该过程没有执行脚本、迁移或业务测试。

## 已知CI差异

服务器CI：2118字节，SHA256 522125fca263c707cae3e81a344015c317fa0abb933e4cb3c2e3caebe3a8d981。
候选CI：2156字节，SHA256 8f182d101fb9f9261d9174b2d1d993d64cd7f5becf2c527b823bc1e20f19a7de。
候选保留production分支push与PR触发项；不覆盖服务器或修改CI。

## 范围限制

324项均为返回文件的单向内容核对。未把未返回、排除目录或归档新增文档算作匹配；18个跳过条目不是逐项完整排除清单。未核验容器内完整文件、挂载关系、环境配置、凭据、数据库运行行为或构建可复现性。
两条CHECK仅确认其迁移文件内容保留，不宣称运行数据库约束已经执行验证。

## 门禁

本提交只新增SRC-02原始证据及派生报告，不修改业务代码。REC-01恢复规则已批准；DEP-01保持G1 / NOT_RELEASED，G2 NOT_STARTED；P0-01保持G3运行态阻断、G5未签收；P0-02 NOT_RELEASED；PRODUCTION_CHANGE_AUTHORIZED=NO。归档不等于验收签收或环境、业务实施授权。
