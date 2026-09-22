import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = path.resolve(import.meta.dirname, "..");
const box = { window: {} };
vm.runInNewContext(readFileSync(path.join(root, "data", "listening-content.js"), "utf8"), box);
const snapshot = box.window.IELTS_ACCOUNT_SNAPSHOT;
const manifest = JSON.parse(readFileSync(path.join(root, "data", "sync-manifest.json"), "utf8"));
const sectionIds = snapshot.catalog.books.flatMap((book) => book.tests.flatMap((test) => test.sectionList.map((section) => String(section.questionId))));
const sections = sectionIds.map((id) => snapshot.sections[id]);
const listenIds = snapshot.catalog.books.flatMap((book) => book.tests.flatMap((test) => test.sectionList.map((section) => String(section.listenId))));
const intensiveSections = listenIds.map((id) => snapshot.intensive?.[id]);
const regularAudioPaths = sections.map((section) => section?.docList?.find((doc) => String(doc.code) === "6")?.list?.find((item) => item.body?.audio)?.body.audio);

assert.equal(new Set(sectionIds).size, sectionIds.length, "目录中存在重复 Section");
assert.ok(sections.every(Boolean), "有 Section 缺少内容快照");
assert.ok(sections.every((section) => section.bPA?.scoreList?.length === 10), "有 Section 不是 10 题");
assert.ok(sections.every((section) => section.docList?.some((doc) => String(doc.code) === "7" && doc.list?.some((item) => item.body))), "有 Section 缺少听力原文");
assert.ok(sections.every((section) => section.docList?.some((doc) => String(doc.code) === "6" && doc.list?.some((item) => item.body?.audio))), "有 Section 缺少音频");
assert.equal(manifest.sectionErrors.length, 0, "题目同步存在错误");
assert.equal(new Set(listenIds).size, listenIds.length, "目录中存在重复精听 ID");
assert.ok(intensiveSections.every((section) => section?.sentence?.length), "有 Section 缺少精听逐句数据");
assert.ok(intensiveSections.every((section) => /^assets\/listening\//.test(section.audioUrl || "")), "有精听音频未改写为本地路径");
assert.ok(intensiveSections.every((section, index) => section.audioUrl !== regularAudioPaths[index]), "精听模块错误复用了做题音频");
assert.equal(manifest.intensiveErrors.length, 0, "精听同步存在错误");
assert.equal(Object.keys(snapshot.intensiveCounts || {}).length, listenIds.length, "精听人数统计不完整");
assert.ok(Number.isFinite(Number(snapshot.intensiveSummary?.totalCount)), "精听累计统计缺失");
assert.equal(manifest.resourceErrors.length, 0, "媒体同步存在错误");
assert.ok(!("name" in snapshot.practiceSummary) && !("photo" in snapshot.practiceSummary), "学习摘要仍包含账号标识");
assert.equal(snapshot.catalog.spptGroups?.length, 4, "按 Section 目录不完整");
assert.equal(snapshot.catalog.topicGroups?.length, 11, "按话题目录不完整");

const assetPaths = new Set();
const forbiddenKeys = [];
const visit = (value) => {
  if (Array.isArray(value)) return value.forEach(visit);
  if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      if (["userInfo", "userId", "examId", "reportId"].includes(key)) forbiddenKeys.push(key);
      visit(item);
    }
    return;
  }
  if (typeof value === "string") for (const match of value.matchAll(/assets\/listening\/[a-z0-9]+\.(?:mp3|m4a|wav|ogg|png|jpe?g|gif|webp|svg)/gi)) assetPaths.add(match[0]);
};
visit(snapshot.sections);
visit(snapshot.intensive);
visit(snapshot.catalog);
assert.equal(forbiddenKeys.length, 0, `快照仍包含用户/考试标识: ${forbiddenKeys.join(", ")}`);
for (const asset of assetPaths) {
  const file = path.join(root, ...asset.split("/"));
  assert.ok(existsSync(file) && statSync(file).size > 0, `媒体文件无效: ${asset}`);
}
assert.equal(assetPaths.size, manifest.resourcesSaved, "媒体引用数与清单不一致");

for (const asset of ["character-logo.png", "character-hero.png"]) {
  const file = path.join(root, "assets", "ui", asset);
  assert.ok(existsSync(file) && statSync(file).size > 0, `界面资源无效: ${asset}`);
}

console.log(`验证通过：${snapshot.catalog.books.length} 册，${sectionIds.length} 个 Section，${sectionIds.length * 10} 题，${intensiveSections.length} 份精听材料，${assetPaths.size} 个本地媒体文件。`);
