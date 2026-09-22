import { mkdir, writeFile } from "node:fs/promises";

const origin = process.env.LISTEN_SOURCE_ORIGIN;
if (!origin) throw new Error("请先通过 LISTEN_SOURCE_ORIGIN 指定内容源地址");
const getJson = async (path) => {
  const response = await fetch(`${origin}${path}`);
  if (!response.ok) throw new Error(`${response.status} ${path}`);
  const payload = await response.json();
  if (payload.code !== 200) throw new Error(payload.msg || `接口失败：${path}`);
  return payload.data;
};

const catalog = await getJson("/api/list/ielts/1/order?value=0");
const books = await Promise.all(
  catalog.jianyaList.map(async (book) => ({
    ...book,
    tests: await getJson(`/api/list/ielts/1/order?value=${book.jianyaId}`),
  })),
);

const snapshot = {
  source: "external-import",
  capturedAt: new Date().toISOString(),
  scope: "公开听力目录元数据（不含题目正文、答案与音频）",
  books,
};

await mkdir(new URL("../data/", import.meta.url), { recursive: true });
await writeFile(
  new URL("../data/listening.js", import.meta.url),
  `window.IELTS_CATALOG = ${JSON.stringify(snapshot, null, 2)};\n`,
  "utf8",
);

console.log(`已保存 ${books.length} 册、${books.reduce((n, book) => n + book.tests.length, 0)} 套测试的公开目录元数据。`);
