import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { gunzipSync } from "node:zlib";

const root = path.resolve(import.meta.dirname, "..");
const session = process.argv[2] || "ielts-imported";
const catalogSource = await readFile(path.join(root, "data", "listening.js"), "utf8");
const context = { window: {} };
vm.runInNewContext(catalogSource, context);
const questionIds = [...new Set(
  context.window.IELTS_CATALOG.books.flatMap((book) =>
    book.tests.flatMap((test) => test.sectionList.map((section) => String(section.questionId))),
  ),
)];

const browserScript = String.raw`
(async()=>{
  const ids=${JSON.stringify(questionIds)};
  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  async function get(path){
    let last;
    for(let attempt=1;attempt<=3;attempt++){
      try{
        const response=await fetch(path,{credentials:"include"});
        const json=await response.json();
        if(response.ok&&json.code===200)return json.data;
        last=new Error(json.message||json.msg||("code "+json.code));
      }catch(error){last=error}
      await sleep(350*attempt);
    }
    throw last;
  }
  async function post(path,params){
    let last;
    for(let attempt=1;attempt<=3;attempt++){
      try{
        const response=await fetch(path,{method:"POST",credentials:"include",body:new URLSearchParams(params)});
        const json=await response.json();
        if(response.ok&&json.status===0)return json.data;
        last=new Error(json.message||("status "+json.status));
      }catch(error){last=error}
      await sleep(350*attempt);
    }
    throw last;
  }
  async function getStatus(path){
    const response=await fetch(path,{credentials:"include"});
    const json=await response.json();
    if(response.ok&&json.status===0)return json.data;
    throw new Error(json.message||("status "+json.status));
  }
  const errors=[];
  const entries=[];
  let cursor=0;
  async function worker(){
    for(;;){
      const index=cursor++;
      if(index>=ids.length)return;
      const questionId=ids[index];
      try{
        const data=await get("/api/questionPreviewQuestion/"+encodeURIComponent(questionId));
        delete data.userInfo;
        if(data.bPA){delete data.bPA.examId;delete data.bPA.userId}
        entries[index]=[questionId,data];
      }catch(error){errors.push({questionId,error:String(error&&error.message||error)})}
      await sleep(80);
    }
  }
  await Promise.all(Array.from({length:4},worker));
  const catalogRoot=await get("/api/list/login/ielts/1/order?value=0");
  const books=[];
  for(const book of catalogRoot.jianyaList){
    books.push({...book,tests:await get("/api/list/login/ielts/1/order?value="+encodeURIComponent(book.jianyaId))});
  }
  const stripExamRefs=groups=>groups.forEach(group=>(group.sectionList||[]).forEach(section=>{delete section.examId;delete section.reportId}));
  books.forEach(book=>stripExamRefs(book.tests));
  const spptSpecs=[["1262","Section 1"],["1263","Section 2"],["1264","Section 3"],["1265","Section 4"]];
  const topicSpecs=[["1251","租房"],["1252","旅游"],["1253","银行"],["1254","图书馆"],["1255","求职"],["1256","咨询申请"],["1257","改造建设"],["1258","医疗"],["1259","活动介绍"],["1260","课题研究"],["1261","学术场景"]];
  const spptGroups=[];
  for(const [id,name] of spptSpecs){const data=await get("/api/list/login/ielts/1/sppt?value="+id);stripExamRefs(data);spptGroups.push({id,name,tests:data})}
  const topicGroups=[];
  for(const [id,name] of topicSpecs){const data=await get("/api/list/login/ielts/1/topic?value="+id);stripExamRefs(data);topicGroups.push({id,name,tests:data})}
  const listenIds=[...new Set(books.flatMap(book=>book.tests).flatMap(test=>test.sectionList).map(section=>String(section.listenId)).filter(Boolean))];
  const intensiveEntries=[];
  const intensiveErrors=[];
  let intensiveCursor=0;
  async function intensiveWorker(){
    for(;;){
      const index=intensiveCursor++;
      if(index>=listenIds.length)return;
      const listenId=listenIds[index];
      try{
        const data=await post("/api/newquestion/getIntensive",{qId:listenId});
        if(Array.isArray(data.sentence))data.sentence=data.sentence.map(({ifCollect,...sentence})=>sentence);
        intensiveEntries[index]=[listenId,data];
      }catch(error){intensiveErrors.push({listenId,error:String(error&&error.message||error)})}
      await sleep(80);
    }
  }
  await Promise.all(Array.from({length:4},intensiveWorker));
  const intensiveSummary=await getStatus("/api/newquestion/getuserIntensiveInfo");
  const intensiveCounts=await getStatus("/api/getListenCounts?qIds="+encodeURIComponent(listenIds.join(",")));
  const practiceSummary=await get("/api/user/practice/summary");
  delete practiceSummary.name;
  delete practiceSummary.photo;
  const payload={
    source:"external-import",
    capturedAt:new Date().toISOString(),
    scope:"账号正常可查看的听力目录、学习摘要、题目、答案、解析与媒体；已剔除用户标识和考试标识",
    catalog:{...catalogRoot,books,spptGroups,topicGroups},
    practiceSummary,
    sections:Object.fromEntries(entries.filter(Boolean)),
    intensive:Object.fromEntries(intensiveEntries.filter(Boolean)),
    intensiveSummary,
    intensiveCounts:Object.fromEntries((intensiveCounts.list||[]).map(item=>[String(item.id),item.listenNum])),
    errors,
    intensiveErrors
  };
  const raw=JSON.stringify(payload);
  const stream=new Blob([raw]).stream().pipeThrough(new CompressionStream("gzip"));
  const bytes=new Uint8Array(await new Response(stream).arrayBuffer());
  let binary="";
  for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));
  return btoa(binary);
})()
`;

const executable = process.platform === "win32" ? "browser-act.exe" : "browser-act";
const result = spawnSync(executable, ["--session", session, "eval", browserScript], {
  encoding: "utf8",
  maxBuffer: 100 * 1024 * 1024,
});
if (result.status !== 0) throw new Error(result.stderr || result.stdout || "BrowserAct 同步失败");

let encoded = result.stdout.trim();
if ((encoded.startsWith("'") && encoded.endsWith("'")) || (encoded.startsWith('"') && encoded.endsWith('"'))) {
  encoded = encoded.slice(1, -1);
}
if (!/^[A-Za-z0-9+/=]+$/.test(encoded)) throw new Error("BrowserAct 返回的数据格式无效");
const snapshot = JSON.parse(gunzipSync(Buffer.from(encoded, "base64")).toString("utf8"));

const origin = process.env.LISTEN_SOURCE_ORIGIN;
if (!origin) throw new Error("请先通过 LISTEN_SOURCE_ORIGIN 指定内容源地址");
const assetPattern = /(?:https?:)?\/\/[^\s"'<>\\]+?\.(?:mp3|m4a|wav|ogg|png|jpe?g|gif|webp|svg)(?:\?[^\s"'<>\\]*)?|\/[^\s"'<>\\]+?\.(?:mp3|m4a|wav|ogg|png|jpe?g|gif|webp|svg)(?:\?[^\s"'<>\\]*)?/gi;
const assetUrls = new Set();
const walkStrings = (value, visit) => {
  if (Array.isArray(value)) return value.forEach((item) => walkStrings(item, visit));
  if (value && typeof value === "object") return Object.values(value).forEach((item) => walkStrings(item, visit));
  if (typeof value === "string") visit(value);
};
walkStrings(snapshot.sections, (value) => {
  for (const match of value.matchAll(assetPattern)) {
    try {
      const url = new URL(match[0], origin);
      if (["http:", "https:"].includes(url.protocol)) assetUrls.add(url.href);
    } catch {}
  }
});
walkStrings(snapshot.intensive, (value) => {
  for (const match of value.matchAll(assetPattern)) {
    try {
      const url = new URL(match[0], origin);
      if (["http:", "https:"].includes(url.protocol)) assetUrls.add(url.href);
    } catch {}
  }
});

const assetsDirectory = path.join(root, "assets", "listening");
await mkdir(assetsDirectory, { recursive: true });
const replacements = new Map();
const resourceErrors = [];
let downloadedBytes = 0;
let assetCursor = 0;
const urls = [...assetUrls];

async function downloadWorker() {
  for (;;) {
    const index = assetCursor++;
    if (index >= urls.length) return;
    const remoteUrl = urls[index];
    try {
      const url = new URL(remoteUrl);
      const extension = path.extname(url.pathname).toLowerCase() || ".bin";
      const filename = `${createHash("sha256").update(remoteUrl).digest("hex").slice(0, 20)}${extension}`;
      const destination = path.join(assetsDirectory, filename);
      let size = 0;
      try { size = (await stat(destination)).size; } catch {}
      if (!size) {
        const response = await fetch(remoteUrl, { headers: { Referer: `${origin}/practice/listen` } });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const buffer = Buffer.from(await response.arrayBuffer());
        if (!buffer.length) throw new Error("空资源");
        await writeFile(destination, buffer);
        size = buffer.length;
      }
      downloadedBytes += size;
      replacements.set(remoteUrl, `assets/listening/${filename}`);
      const urlWithoutOrigin = `${url.pathname}${url.search}`;
      replacements.set(urlWithoutOrigin, `assets/listening/${filename}`);
      if (remoteUrl.startsWith("https:")) replacements.set(remoteUrl.slice(6), `assets/listening/${filename}`);
    } catch (error) {
      resourceErrors.push({ key: createHash("sha256").update(remoteUrl).digest("hex").slice(0, 12), error: String(error.message || error) });
    }
  }
}
await Promise.all(Array.from({ length: 4 }, downloadWorker));

const replaceAssets = (value) => {
  if (Array.isArray(value)) return value.map(replaceAssets);
  if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) value[key] = replaceAssets(item);
    return value;
  }
  if (typeof value !== "string") return value;
  let result = value;
  for (const [remote, local] of replacements) result = result.split(remote).join(local);
  return result;
};
replaceAssets(snapshot.sections);
replaceAssets(snapshot.intensive);

const manifest = {
  capturedAt: snapshot.capturedAt,
  books: snapshot.catalog.books.length,
  tests: snapshot.catalog.books.reduce((sum, book) => sum + book.tests.length, 0),
  sectionsExpected: questionIds.length,
  sectionsSaved: Object.keys(snapshot.sections).length,
  sectionErrors: snapshot.errors,
  intensiveExpected: Object.values(snapshot.catalog.books).flatMap((book) => book.tests).flatMap((test) => test.sectionList).filter((section) => section.listenId).length,
  intensiveSaved: Object.keys(snapshot.intensive || {}).length,
  intensiveErrors: snapshot.intensiveErrors,
  intensiveCountsSaved: Object.keys(snapshot.intensiveCounts || {}).length,
  resourcesFound: urls.length,
  resourcesSaved: replacements.size ? new Set(replacements.values()).size : 0,
  resourceErrors,
  resourceBytes: downloadedBytes,
};

await writeFile(
  path.join(root, "data", "listening-content.js"),
  `window.IELTS_ACCOUNT_SNAPSHOT = ${JSON.stringify(snapshot)};\n`,
  "utf8",
);
await writeFile(path.join(root, "data", "sync-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(JSON.stringify(manifest, null, 2));
