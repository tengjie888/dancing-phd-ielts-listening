# 爱跳舞的女博士 · 剑雅听力练习

一个无需安装前端依赖的本地听力练习站。页面按原站的听力目录、按钮命名和交互路径实现，当前快照包含 16 册、64 套 Test、256 个 Section、2560 道题、256 份逐句精听材料，以及对应的做题音频、独立精听音频、答案、解析、原文、译文和精听人数。答题进度与成绩只保存在浏览器 `localStorage`。

在线学习：https://tengjie888.github.io/dancing-phd-ielts-listening/

主要流程包括：

- 原站三种做题状态：`开始做题 / 精听练习`、`重新做题 / 继续做题 / 精听练习`、`重新做题 / 查看结果 / 精听练习`；
- 做题前耳机声音检测、Section 答题、自动保存、提交判分、答案解析和听力原文；
- 精听总览、按册精听目录、单句精听、全文精听、循环次数、倍速、原文/译文显隐、快捷键、音频下载和本地纠错记录。

## 使用

可直接双击 `index.html`，也可在项目目录启动本地服务器后访问 `http://localhost:4173`：

```powershell
py -m http.server 4173
```

## 校验

```powershell
node scripts/validate-local-snapshot.mjs
```

## 更新数据

更新公开目录：

```powershell
node scripts/sync-public-metadata.mjs
```

在已经登录、由当前任务创建的 BrowserAct 会话中更新账号可查看的完整听力内容：

```powershell
node scripts/sync-authenticated-content.mjs ielts-imported
```

同步脚本只执行读取，并在保存前移除用户标识与考试标识。

## 授权声明

本项目为独立学习工具，与剑桥大学出版社及原平台无隶属或合作关系。题库与音频由项目维护者依据已取得的公开再发布授权提供。
