const accountSnapshot = window.IELTS_ACCOUNT_SNAPSHOT;
const catalog = accountSnapshot?.catalog?.books?.length
  ? { ...window.IELTS_CATALOG, ...accountSnapshot.catalog, capturedAt: accountSnapshot.capturedAt }
  : window.IELTS_CATALOG;

const state = {
  mode: "order",
  bookId: "0",
  sectionId: "1262",
  topicId: "1251",
  intensiveTopicIndex: 0,
  currentSection: null,
  currentData: null,
  progress: JSON.parse(localStorage.getItem("ielts-local-progress") || "{}"),
};

const intensiveState = {
  section: null,
  data: null,
  index: 0,
  mode: "sentence",
  repeat: 1,
  speed: 1,
  repeatCount: 0,
  showEn: false,
  showCn: false,
  fullTextRevealed: false,
};

const intensiveTopics = [
  ["租房", ["1758", "1764", "1309", "177", "293", "281", "269"]],
  ["旅游", ["1830", "1776", "1718", "1730", "1731", "1702", "1710", "1286", "1291", "1295", "1299", "178", "190", "161", "174", "294", "297", "302", "262", "266", "270", "246", "250", "225"]],
  ["银行", ["249"]],
  ["图书馆", ["1288", "1294", "255", "229", "240"]],
  ["求职", ["1805", "1813", "1788", "1796", "1768", "1772", "1761", "1717", "1738", "1327", "289", "285", "265"]],
  ["咨询申请", ["1817", "1834", "1826", "1809", "1810", "1784", "1792", "1780", "1760", "1696", "1705", "1709", "1323", "1305", "1287", "1298", "181", "169", "277", "257", "261", "241", "245", "253", "227", "231", "233", "237"]],
  ["改造建设", ["1789", "1797", "1699", "182", "184", "186", "165", "166", "173", "298", "286", "242"]],
  ["医疗", ["1701", "301", "280"]],
  ["活动介绍", ["1819", "1823", "1827", "1831", "1800", "1801", "1806", "1814", "1785", "1793", "1769", "1777", "1745", "1752", "1765", "1739", "1698", "1706", "1707", "1708", "1324", "1306", "1310", "1328", "1290", "185", "189", "162", "163", "170", "290", "273", "274", "278", "282", "258", "254", "226", "230", "234", "238"]],
  ["课题研究", ["1824", "1828", "1832", "1802", "1807", "1811", "1815", "1787", "1791", "1795", "1799", "1770", "1771", "1773", "1774", "1775", "1779", "1781", "1782", "1783", "1746", "1753", "1762", "1766", "1719", "1740", "1732", "1325", "1311", "1329", "1292", "1296", "1301", "179", "180", "188", "191", "192", "164", "168", "172", "176", "291", "295", "299", "303", "276", "279", "284", "288", "259", "263", "267", "271", "243", "247", "251", "228", "232", "236", "239"]],
  ["学术场景", ["1820", "1821", "1825", "1833", "1803", "1808", "1812", "1816", "1790", "1794", "1798", "1778", "1750", "1759", "1763", "1767", "1720", "1741", "1733", "1307", "1289", "1293", "1297", "1300", "183", "187", "167", "171", "175", "292", "296", "300", "304", "275", "283", "287", "260", "264", "268", "272", "244", "248", "252", "256", "235"]],
  ["人文社科", ["1829", "1786", "1700", "1703", "1704", "1711", "1712", "1326", "1308", "1313", "1330"]],
];

const $ = (selector) => document.querySelector(selector);
const content = $("#catalogContent");
const filters = $("#bookFilters");
const dialog = $("#practiceDialog");
const intensiveDialog = $("#intensiveDialog");
const intensiveAudio = $("#intensiveAudio");
let correctionContext = "intensive";

function localDate() {
  const now = new Date();
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-");
}

function saveState() {
  localStorage.setItem("ielts-local-progress", JSON.stringify(state.progress));
  renderStats();
}

function allSections() {
  return catalog.books.flatMap((book) =>
    book.tests.flatMap((test) => test.sectionList.map((section) => ({ ...section, book, test }))),
  );
}

function sectionKey(section) {
  return String(section.questionId);
}

function parseJson(value) {
  try { return JSON.parse(value || "{}"); } catch { return {}; }
}

function safeHtml(html = "") {
  const template = document.createElement("template");
  template.innerHTML = html;
  template.content.querySelectorAll("script,iframe,object,embed,link,form").forEach((node) => node.remove());
  template.content.querySelectorAll("*").forEach((node) => {
    for (const attribute of [...node.attributes]) {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim();
      if (name.startsWith("on") || (["src", "href"].includes(name) && !/^(?:assets\/listening\/|#|data:image\/)/i.test(value))) {
        node.removeAttribute(attribute.name);
      }
    }
  });
  return template.innerHTML;
}

function renderFilters() {
  if (state.mode === "section") {
    filters.innerHTML = catalog.spptGroups.map((group) => `<button class="filter-button ${state.sectionId === String(group.id) ? "active" : ""}" data-section-group="${group.id}">${group.name}</button>`).join("");
    return;
  }
  if (state.mode === "topic") {
    filters.innerHTML = catalog.topicGroups.map((group) => `<button class="filter-button ${state.topicId === String(group.id) ? "active" : ""}" data-topic-group="${group.id}">${group.name}</button>`).join("");
    return;
  }
  const items = [{ id: "0", name: "全部剑雅" }, ...catalog.books.map((book) => ({ id: String(book.jianyaId), name: book.jianyaName }))];
  filters.innerHTML = items.map(({ id, name }) => `<button class="filter-button ${state.bookId === id ? "active" : ""}" data-book="${id}">${name}</button>`).join("");
}

function renderCards() {
  content.innerHTML = catalog.books.map((book) => `<section class="book-group">
    <h2>${book.jianyaName}</h2>
    <div class="test-grid">${book.tests.map((test, testIndex) => {
      const done = test.sectionList.filter((section) => state.progress[sectionKey(section)]?.checked).length;
      return `<button class="test-card" type="button" data-open-book="${book.jianyaId}" data-open-test="${testIndex}"><strong>${test.name}</strong><span>完成 ${done} / ${test.sectionList.length}</span><progress value="${done}" max="${test.sectionList.length}" aria-label="完成 ${done} / ${test.sectionList.length}"></progress></button>`;
    }).join("")}</div>
  </section>`).join("");
}

function tableActions(section, progress) {
  const key = sectionKey(section);
  const intensive = `<button class="table-action icon-listen" data-intensive="${key}" data-int-open-mode="full">精听练习</button>`;
  if (progress?.checked) {
    return `<td class="operation"><button class="table-action icon-edit" data-practice="${key}" data-practice-action="restart">重新做题</button></td>
      <td class="operation"><button class="table-action icon-view" data-practice="${key}" data-practice-action="result">查看结果</button></td>
      <td class="operation">${intensive}</td>`;
  }
  if (progress?.started || (progress?.answered || 0) > 0) {
    return `<td class="operation"><button class="table-action icon-edit" data-practice="${key}" data-practice-action="restart">重新做题</button></td>
      <td class="operation"><button class="table-action icon-edit" data-practice="${key}" data-practice-action="continue">继续做题</button></td>
      <td class="operation">${intensive}</td>`;
  }
  return `<td class="operation"></td>
    <td class="operation"><button class="table-action icon-edit" data-practice="${key}" data-practice-action="start">开始做题</button></td>
    <td class="operation">${intensive}</td>`;
}

function renderTable(tests) {
  if (!tests.length) {
    content.innerHTML = `<div class="empty"><span class="empty-mark">⌕</span>本地目录中没有找到匹配内容</div>`;
    return;
  }
  content.innerHTML = tests.map((test) => `
    <table class="test-table">
      <thead><tr><th>${test.name}</th><th>平均正确</th><th>我的结果</th><th class="action-heading" colspan="3"></th></tr></thead>
      <tbody>
        ${test.sectionList.map((section) => {
          const key = sectionKey(section);
          const progress = state.progress[key];
          const score = Number.isFinite(progress?.correct) ? `${progress.correct}/${progress.total || 10}` : "--";
          return `<tr>
            <td><button class="section-title" data-practice="${key}" data-practice-action="${progress?.checked ? "result" : progress?.started || progress?.answered ? "continue" : "start"}">${section.title}</button><span class="section-subtitle">${section.subTitle || ""}</span></td>
            <td>${section.avgRightRate || "--"}</td>
            <td>${score}</td>
            ${tableActions(section, progress)}
          </tr>`;
        }).join("")}
      </tbody>
    </table>
  `).join("");
}

function selectedTests() {
  return catalog.books
    .filter((book) => state.bookId === "0" || String(book.jianyaId) === state.bookId)
    .flatMap((book) => book.tests.map((test) => ({ ...test, bookName: book.jianyaName })));
}

function renderIntensiveOverview() {
  $("#intensiveLanding").innerHTML = `<div class="intensive-landing-hero"><img src="assets/ui/character-hero.png" alt="爱跳舞的女博士卡通形象正在进行精听训练"><div><small>爱跳舞的女博士 · 精听练习</small><strong>听力提升<br>从精听开始</strong><span>听清每个词，也听懂每句话</span></div></div>
    <div class="intensive-landing-layout">
      <div class="intensive-landing-main">
        <article class="intensive-why"><h2>为什么需要精听？</h2><p>精听通过逐句听写提高对英语发音的反应速度和理解能力。它不仅要求听懂大意，还要准确捕捉句子里的每个词和细节，帮助你找到连读、弱读、词汇和理解上的薄弱点，再通过反复练习逐一解决。泛听重在积累，精听重在质量，两者结合能让听力训练更扎实。</p></article>
        <article class="intensive-materials"><h2>听力训练材料</h2><p>剑雅5-20全套音频逐句拆分，适合系统练习与复盘</p><div class="material-card"><img src="assets/ui/character-logo.png" alt="爱跳舞的女博士人物标志"><div><h3>剑雅听力5-20 精听练习　<small>备考必备</small><b>HOT</b></h3><p>单句精听与全文精听自由切换，集中解决听辨问题</p></div><button type="button" data-open-intensive-catalog>立即练习</button></div></article>
      </div>
    </div>`;
}

function renderIntensiveCatalog() {
  const tests = selectedTests();
  $("#intensiveLanding").innerHTML = `<div class="intensive-catalog-page"><div class="intensive-breadcrumb"><button type="button" data-mode="intensive">精听首页</button><span> &gt; 剑雅听力5-20精听练习</span></div><div class="intensive-catalog-layout"><main><section class="intensive-catalog-heading"><h2>剑雅听力5-20精听练习 <small>LISTENING</small></h2><div><button class="active" type="button">剑雅听力按顺序</button><button type="button" data-mode="intensiveTopic">剑雅听力按话题</button></div><svg class="headphones" viewBox="0 0 120 95" aria-hidden="true"><path d="M21 52a39 39 0 0 1 78 0" fill="none" stroke="#7c7ae6" stroke-width="9" stroke-linecap="round"/><path d="M17 50h17v34H23a9 9 0 0 1-9-9V57a7 7 0 0 1 3-7Zm86 0H86v34h11a9 9 0 0 0 9-9V57a7 7 0 0 0-3-7Z" fill="#7c7ae6"/></svg></section><section class="intensive-catalog-card"><nav>${catalog.books.map((book) => `<button class="${state.bookId === String(book.jianyaId) ? "active" : ""}" type="button" data-book="${book.jianyaId}">${book.jianyaName}</button>`).join("")}</nav><div class="intensive-catalog-tables">
    ${tests.map((test) => `<table class="test-table intensive-table">
      <thead><tr><th>${test.name}</th><th>精听人数</th><th></th><th></th></tr></thead>
      <tbody>${test.sectionList.filter((section) => section.listenId).map((section) => {
        const key = sectionKey(section);
        const count = accountSnapshot?.intensiveCounts?.[String(section.listenId)] || 0;
        return `<tr><td><span class="section-title">${section.title}</span><span class="section-subtitle">${section.subTitle || ""}</span></td><td class="listen-count">${count}人精听过</td><td><button class="table-action icon-listen" data-intensive="${key}" data-int-open-mode="sentence">单句精听</button></td><td><button class="table-action icon-listen" data-intensive="${key}" data-int-open-mode="full">全文精听</button></td></tr>`;
      }).join("")}</tbody>
    </table>`).join("")}</div></section></main></div></div>`;
}

function renderIntensiveTopicCatalog() {
  const [topicName, listenIds] = intensiveTopics[state.intensiveTopicIndex] || intensiveTopics[0];
  const byListenId = new Map(allSections().map((section) => [String(section.listenId), section]));
  const rows = listenIds.map((listenId) => ({ listenId, section: byListenId.get(String(listenId)) })).filter((item) => item.section);
  $("#intensiveLanding").innerHTML = `<div class="intensive-catalog-page"><div class="intensive-breadcrumb"><button type="button" data-mode="intensive">精听首页</button><span> &gt; 剑雅听力5-20精听练习</span></div><div class="intensive-catalog-layout"><main><section class="intensive-catalog-heading"><h2>剑雅听力5-20精听练习 <small>LISTENING</small></h2><div><button type="button" data-mode="intensiveCatalog">剑雅听力按顺序</button><button class="active" type="button">剑雅听力按话题</button></div><svg class="headphones" viewBox="0 0 120 95" aria-hidden="true"><path d="M21 52a39 39 0 0 1 78 0" fill="none" stroke="#7c7ae6" stroke-width="9" stroke-linecap="round"/><path d="M17 50h17v34H23a9 9 0 0 1-9-9V57a7 7 0 0 1 3-7Zm86 0H86v34h11a9 9 0 0 0 9-9V57a7 7 0 0 0-3-7Z" fill="#7c7ae6"/></svg></section><section class="intensive-catalog-card intensive-topic-card"><nav>${intensiveTopics.map(([name], index) => `<button class="${index === state.intensiveTopicIndex ? "active" : ""}" type="button" data-intensive-topic="${index}">${name}</button>`).join("")}</nav><div class="intensive-catalog-tables"><h3 class="intensive-topic-title">${topicName} <small>(${rows.length})</small></h3><table class="test-table intensive-table intensive-topic-table"><tbody>${rows.map(({ listenId, section }) => { const key = sectionKey(section); const title = `${section.book.jianyaName} ${section.test.name}-${section.title}`; const subtitle = accountSnapshot?.intensive?.[String(listenId)]?.qName || section.subTitle || ""; const count = accountSnapshot?.intensiveCounts?.[String(listenId)] || 0; return `<tr><td><span class="section-title">${title}</span><span class="section-subtitle">${subtitle}</span></td><td class="listen-count">${count}人精听过</td><td><button class="table-action icon-listen" data-intensive="${key}" data-int-open-mode="sentence">单句精听</button></td><td><button class="table-action icon-listen" data-intensive="${key}" data-int-open-mode="full">全文精听</button></td></tr>`; }).join("")}</tbody></table></div></section></main></div></div>`;
}

function renderCatalog() {
  const isIntensiveOverview = state.mode === "intensive";
  const isIntensiveCatalog = state.mode === "intensiveCatalog";
  const isIntensiveTopic = state.mode === "intensiveTopic";
  const isIntensiveStandalone = isIntensiveOverview || isIntensiveCatalog || isIntensiveTopic;
  document.body.classList.toggle("intensive-landing-open", isIntensiveStandalone);
  document.body.classList.toggle("intensive-catalog-open", isIntensiveCatalog || isIntensiveTopic);
  $(".page-shell").hidden = isIntensiveStandalone;
  $("#intensiveLanding").hidden = !isIntensiveStandalone;
  filters.classList.toggle("is-hidden", isIntensiveOverview);
  if (!isIntensiveOverview) renderFilters();
  document.querySelectorAll(".mode-tabs [data-mode]").forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === state.mode || (button.dataset.mode === "intensive" && isIntensiveCatalog));
  });
  if (isIntensiveOverview) return renderIntensiveOverview();
  if (isIntensiveCatalog) return renderIntensiveCatalog();
  if (isIntensiveTopic) return renderIntensiveTopicCatalog();
  if (state.mode === "order" && state.bookId === "0") return renderCards();
  if (state.mode === "section") {
    const group = catalog.spptGroups.find((item) => String(item.id) === state.sectionId);
    return renderTable(group?.tests || []);
  }
  if (state.mode === "topic") {
    const group = catalog.topicGroups.find((item) => String(item.id) === state.topicId);
    return renderTable(group?.tests || []);
  }
  renderTable(selectedTests());
}

function dragOptionBank(data) {
  if (!data.options?.length) return "";
  return `<div class="drag-options"><p class="drag-options-title">${safeHtml(data.head || "")}</p><ul class="options-list">${data.options.map((item) => `<li><button type="button" class="option-item" draggable="true" data-drag-option="${item.name}"><b>${item.name}</b><span class="drag-option-content">${safeHtml(item.option)}</span></button></li>`).join("")}</ul></div>`;
}

function renderQuestionBlock(block, index) {
  const data = parseJson(block.content);
  const analysis = parseJson(block.contentAnalyze);
  const analysisHtml = analysis.body ? `<details class="analysis-panel"><summary>题目解析</summary>${safeHtml(analysis.body)}</details>` : "";
  if (String(block.type) === "101") return `<section class="question-intro">${safeHtml(data.title)}</section>`;
  if (["201", "202"].includes(String(block.type))) {
    const multiple = Number(data.valcnt) > 1;
    return `<section class="question-block" data-block="${index}"><div class="question-title">${safeHtml(data.title)}</div><div class="choice-list" role="group" aria-label="${data.name || "选择题"}">
      ${(data.options || []).map((item) => `<label class="answer-control choice-option"><input type="${multiple ? "checkbox" : "radio"}" name="${data.sccode}" value="${item.name}" data-score-code="${data.sccode}"><b>${item.name}</b><span>${safeHtml(item.option)}</span></label>`).join("")}
      </div>${analysisHtml}</section>`;
  }
  if (String(block.type) === "223") {
    const scoreRows = (state.currentData?.bPA?.scoreList || []).filter((row) => row.scoreCode === data.sccode);
    const choices = data.title || [];
    return `<section class="question-block mapping-block" data-block="${index}"><table class="matrix-table listen"><thead><tr><th>Column 1</th>${choices.map((letter) => `<th>${letter}</th>`).join("")}</tr></thead><tbody>
      ${(data.options || []).map((item, itemIndex) => { const questionNumber = scoreRows.find((row) => Number(row.arrayIndex) === itemIndex)?.questionIndex || scoreRows[itemIndex]?.questionIndex || item.name; return `<tr><td class="matrix-title"><b>${questionNumber}.</b> ${safeHtml(item.option)}</td>${choices.map((letter) => `<td><label class="answer-control matrix-answer" aria-label="第 ${questionNumber} 题选择 ${letter}"><input type="radio" name="${data.sccode}-${itemIndex}" value="${letter}" data-score-code="${data.sccode}" data-answer-index="${itemIndex}"><i class="matrix-hook"></i></label></td>`).join("")}</tr>`; }).join("")}
      </tbody></table>${analysisHtml}</section>`;
  }
  if (String(block.type) === "208") return `<section class="question-block source-rich drag-block" data-block="${index}" data-reuse="${Number(data.isReuse) === 1 ? "1" : "0"}">${dragOptionBank(data)}<div class="drag-question">${safeHtml(data.title)}</div>${analysisHtml}</section>`;
  if (String(block.type) === "216") return `<section class="question-block source-rich" data-block="${index}">${safeHtml(data.title)}${analysisHtml}</section>`;
  return "";
}

function audioFrom(sectionData) {
  return sectionData.docList?.find((doc) => String(doc.code) === "6")?.list?.find((item) => item.body?.audio)?.body.audio;
}

function transcriptFrom(sectionData) {
  return sectionData.docList?.find((doc) => String(doc.code) === "7")?.list?.map((item) => item.body || "").join("") || "";
}

function currentAnswers() {
  if (!state.currentSection) return {};
  return state.progress[sectionKey(state.currentSection)]?.answers || {};
}

function controlsFor(code) {
  return [...$("#practiceBody").querySelectorAll("[data-score-code]")].filter((item) => item.dataset.scoreCode === code);
}

function paintDropAnswer(drop, value) {
  const block = drop.closest(".drag-block");
  const valueBox = drop.querySelector(".drop-value");
  drop.value = value || "";
  drop.classList.toggle("filled", Boolean(value));
  if (!value) {
    valueBox.textContent = "";
    return;
  }
  const option = [...block.querySelectorAll("[data-drag-option]")].find((item) => item.dataset.dragOption === value);
  valueBox.innerHTML = option ? `<b>${value}</b>${option.querySelector(".drag-option-content").innerHTML}` : value;
}

function refreshDragOptions(block) {
  if (block.dataset.reuse === "1") return;
  const used = new Set([...block.querySelectorAll(".droparea")].map((item) => item.value).filter(Boolean));
  block.querySelectorAll("[data-drag-option]").forEach((option) => {
    option.hidden = used.has(option.dataset.dragOption);
  });
}

function setDropAnswer(drop, value) {
  const block = drop.closest(".drag-block");
  paintDropAnswer(drop, value);
  delete block.dataset.selectedDrag;
  block.querySelectorAll("[data-drag-option]").forEach((option) => option.classList.remove("selected"));
  refreshDragOptions(block);
  syncControl(drop);
}

function prepareControls() {
  const answers = currentAnswers();
  $("#practiceBody").querySelectorAll(".drag-block input").forEach((input) => {
    const code = input.getAttribute("sccode") || input.closest("[sccode]")?.getAttribute("sccode");
    if (!code) return;
    const row = (state.currentData?.bPA?.scoreList || []).find((item) => item.scoreCode === code);
    const drop = document.createElement("button");
    drop.type = "button";
    drop.className = "droparea answer-control";
    drop.dataset.scoreCode = code;
    drop.setAttribute("aria-label", `第 ${row?.questionIndex || ""} 题答案`.trim());
    drop.innerHTML = `<span class="q-index">${row?.questionIndex || ""}</span><span class="drop-value"></span>`;
    input.replaceWith(drop);
  });
  $("#practiceBody").querySelectorAll(".source-rich:not(.drag-block) input").forEach((input) => {
    const code = input.getAttribute("sccode") || input.closest("[sccode]")?.getAttribute("sccode");
    if (!code) return;
    input.type = "text";
    input.autocomplete = "off";
    input.dataset.scoreCode = code;
    input.setAttribute("aria-label", `答案 ${input.placeholder || ""}`.trim());
    input.closest("[sccode]")?.classList.add("answer-control");
    if (!input.closest(".answer-control")) input.classList.add("answer-control");
  });
  $("#practiceBody").querySelectorAll("[data-score-code]").forEach((control) => {
    const saved = answers[control.dataset.scoreCode];
    if (control.classList.contains("droparea")) paintDropAnswer(control, typeof saved === "string" ? saved : "");
    else if (control.dataset.answerIndex !== undefined && control.type === "radio") control.checked = saved?.[Number(control.dataset.answerIndex)] === control.value;
    else if (control.dataset.answerIndex !== undefined) control.value = saved?.[Number(control.dataset.answerIndex)] || "";
    else if (control.type === "checkbox") control.checked = Array.isArray(saved) && saved.includes(control.value);
    else if (control.type === "radio") control.checked = saved === control.value;
    else control.value = typeof saved === "string" ? saved : "";
  });
  $("#practiceBody").querySelectorAll(".drag-block").forEach(refreshDragOptions);
}

function groupRows(rows) {
  const seen = new Map();
  const totals = rows.reduce((map, row) => map.set(row.scoreCode, (map.get(row.scoreCode) || 0) + 1), new Map());
  return rows.map((row) => {
    const occurrence = seen.get(row.scoreCode) || 0;
    seen.set(row.scoreCode, occurrence + 1);
    return { row, occurrence, groupSize: totals.get(row.scoreCode) };
  });
}

function rowValues(entry, answers = currentAnswers()) {
  const { row, occurrence, groupSize } = entry;
  const saved = answers[row.scoreCode];
  if (String(row.rightAnswer).includes(",")) return { given: Array.isArray(saved) ? saved[row.arrayIndex] || "" : "", expected: String(row.rightAnswer).split(",")[row.arrayIndex] || "" };
  if (Array.isArray(saved) && groupSize > 1) return { given: [...saved].sort()[occurrence] || "", expected: String(row.rightAnswer)[occurrence] || "" };
  return { given: typeof saved === "string" ? saved : "", expected: String(row.rightAnswer || "") };
}

function isCorrect(given, expected) {
  const normalized = String(given).trim().replace(/\s+/g, " ").toLowerCase();
  return String(expected).split("|").some((answer) => normalized === answer.trim().replace(/\s+/g, " ").toLowerCase());
}

function formatCostTime(seconds) {
  const total = Math.max(0, Math.floor(seconds || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total - hours * 3600) / 60);
  const rest = total - hours * 3600 - minutes * 60;
  if (hours >= 1) return minutes === 0 ? `${hours}h` : `${hours}h${minutes}m`;
  if (minutes >= 1) return rest === 0 ? `${minutes}min` : `${minutes}m${rest}s`;
  return `${rest}s`;
}

function answeredRows(rows, answers = currentAnswers()) {
  return groupRows(rows).filter((entry) => rowValues(entry, answers).given.trim()).length;
}

function updateQuestionDots() {
  const rows = state.currentData?.bPA?.scoreList || [];
  const checked = state.progress[sectionKey(state.currentSection)]?.checked;
  $("#questionDots").innerHTML = groupRows(rows).map((entry, index) => {
    const { given, expected } = rowValues(entry);
    const status = checked ? (isCorrect(given, expected) ? " correct" : " wrong") : (given.trim() ? " active" : "");
    return `<button type="button" class="${status}" data-question-row="${index}" aria-label="第 ${entry.row.questionIndex} 题">${entry.row.questionIndex}</button>`;
  }).join("");
}

function syncControl(target) {
  const code = target.dataset.scoreCode;
  if (!code || !state.currentSection) return;
  const key = sectionKey(state.currentSection);
  const record = state.progress[key] || {};
  const answers = { ...(record.answers || {}) };
  if (target.dataset.answerIndex !== undefined) {
    const values = Array.isArray(answers[code]) ? [...answers[code]] : [];
    values[Number(target.dataset.answerIndex)] = target.value;
    answers[code] = values;
  } else if (target.type === "checkbox") answers[code] = controlsFor(code).filter((item) => item.checked).map((item) => item.value).sort();
  else if (target.type === "radio") answers[code] = controlsFor(code).find((item) => item.checked)?.value || "";
  else answers[code] = target.value;
  const rows = state.currentData?.bPA?.scoreList || [];
  state.progress[key] = { ...record, answers, answered: answeredRows(rows, answers), checked: false, complete: false, started: true, elapsed: examElapsedSeconds(), date: localDate() };
  $("#resultSummary").hidden = true;
  $("#answerReview").hidden = true;
  $("#practiceBody").querySelectorAll(".analysis-panel").forEach((item) => { item.open = false; item.hidden = true; });
  saveState();
  updateQuestionDots();
}

function renderAnswerReview(rows) {
  const transcript = transcriptFrom(state.currentData);
  $("#answerReview").innerHTML = `<h3>正确答案</h3><div class="answer-key">${groupRows(rows).map((entry) => {
    const { expected } = rowValues(entry);
    return `<span><b>${entry.row.questionIndex}</b>${expected.split("|").join(" / ")}</span>`;
  }).join("")}</div>${transcript ? `<details class="transcript"><summary>查看听力原文</summary>${safeHtml(transcript)}</details>` : ""}`;
}

function renderPracticeResult(results, answered, correct) {
  const total = results.length;
  const wrong = answered - correct;
  const unanswered = total - answered;
  const progress = state.progress[sectionKey(state.currentSection)] || {};
  const elapsed = progress.elapsed || examElapsedSeconds();
  const date = new Date();
  const dateLabel = date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  $("#resultElapsed").textContent = `总耗时：${formatCostTime(elapsed)}`;
  $("#resultSectionTitle").textContent = `${state.currentSection.book.jianyaName} ${state.currentSection.test.name}-${state.currentSection.title}`;
  $("#resultDate").textContent = `Date ${dateLabel}`;
  const average = state.currentSection.avgRightRate || "--";
  const averageCorrect = Number(String(average).split("/")[0]);
  const comparison = Number.isFinite(averageCorrect) ? (correct > averageCorrect ? "green" : correct < averageCorrect ? "red" : "") : "";
  $("#resultMetrics").innerHTML = `<tr><td>${total}</td><td>${correct}</td><td>${wrong}</td><td>${unanswered}</td><td class="${comparison}">${correct}/${total}</td><td>${average}</td></tr>`;
  $("#resultAnswerRows").innerHTML = results.map((result) => `<tr><td>${result.row.questionIndex}</td><td class="${result.given ? result.correct ? "green" : "red" : ""}">${safeHtml(result.given || "--")}</td><td>${safeHtml(result.expected.split("|").join(" / "))}</td></tr>`).join("");
  const correctRate = total ? correct / total * 100 : 0;
  const wrongRate = total ? wrong / total * 100 : 0;
  $("#resultDonut").style.background = `conic-gradient(#10a998 0 ${correctRate}%, #ff6b78 ${correctRate}% ${correctRate + wrongRate}%, #c9cfdd ${correctRate + wrongRate}% 100%)`;
  $("#resultCorrectLabel").textContent = `正确${correct}题  ${Math.round(correctRate)}%`;
  $("#resultWrongLabel").textContent = `错误${wrong}题  ${Math.round(wrongRate)}%`;
  $("#resultUnansweredLabel").textContent = `未做${unanswered}题  ${Math.max(0, 100 - Math.round(correctRate) - Math.round(wrongRate))}%`;
  pauseExamTimer();
  $("#practiceAudioElement").pause();
  $("#practiceResult").hidden = false;
  document.querySelector(".exam-dialog-card").classList.add("showing-result");
}

function checkAnswers(preserveElapsed = false) {
  const rows = state.currentData?.bPA?.scoreList || [];
  if (!rows.length) return;
  const key = sectionKey(state.currentSection);
  const results = groupRows(rows).map((entry) => {
    const values = rowValues(entry);
    return { ...entry, ...values, correct: isCorrect(values.given, values.expected) };
  });
  const answered = results.filter((item) => item.given.trim()).length;
  const correct = results.filter((item) => item.correct).length;
  const previous = state.progress[key] || {};
  state.progress[key] = { ...previous, answered, correct, total: rows.length, checked: true, complete: answered === rows.length, date: localDate(), elapsed: preserveElapsed ? previous.elapsed || 0 : examElapsedSeconds() };
  $("#practiceBody").querySelectorAll(".answer-control").forEach((item) => item.classList.remove("is-correct", "is-wrong"));
  const resultGroups = new Map();
  for (const result of results) resultGroups.set(result.row.scoreCode, [...(resultGroups.get(result.row.scoreCode) || []), result]);
  for (const [code, codeResults] of resultGroups) {
    const controls = controlsFor(code);
    if (controls[0]?.dataset.answerIndex !== undefined) {
      controls.forEach((control) => {
        const result = codeResults.find((item) => item.row.arrayIndex === Number(control.dataset.answerIndex));
        const wrapper = control.closest(".answer-control") || control;
        if (control.value === result?.expected) wrapper.classList.add("is-correct");
        else if (control.checked) wrapper.classList.add("is-wrong");
      });
    } else if (controls[0]?.type === "checkbox" || controls[0]?.type === "radio") {
      const expected = new Set(codeResults.map((result) => result.expected));
      controls.forEach((control) => {
        const wrapper = control.closest(".answer-control") || control;
        if (expected.has(control.value)) wrapper.classList.add("is-correct");
        else if (control.checked) wrapper.classList.add("is-wrong");
      });
    } else {
      controls.forEach((control) => {
        const result = control.dataset.answerIndex === undefined ? codeResults[0] : codeResults.find((item) => item.row.arrayIndex === Number(control.dataset.answerIndex));
        (control.closest(".answer-control") || control).classList.add(result?.correct ? "is-correct" : "is-wrong");
      });
    }
  }
  $("#practiceBody").querySelectorAll(".analysis-panel").forEach((item) => { item.hidden = false; });
  $("#resultSummary").innerHTML = `<strong>${correct} / ${rows.length}</strong><span>答对 ${correct} 题，已作答 ${answered} 题</span>`;
  $("#resultSummary").hidden = false;
  renderAnswerReview(rows);
  $("#answerReview").hidden = false;
  saveState();
  updateQuestionDots();
  renderCatalog();
  renderPracticeResult(results, answered, correct);
}

function renderPracticeWorkspace(showResult = false, resumeSaved = false) {
  const section = state.currentSection;
  const sectionData = state.currentData;
  $("#practiceStart").hidden = true;
  $("#practiceWorkspace").hidden = false;
  $("#practiceResult").hidden = true;
  $("#pauseOverlay").hidden = true;
  $("#quitOverlay").hidden = true;
  document.querySelector(".exam-dialog-card").classList.remove("showing-result");
  document.querySelectorAll(".exam-runtime-controls").forEach((item) => { item.hidden = false; });
  $("#pausePractice").textContent = "暂停答题";
  const audio = audioFrom(sectionData);
  const audioElement = $("#practiceAudioElement");
  audioElement.src = audio || "";
  audioElement.volume = Number($("#practiceVolume").value);
  if (audio && !showResult) audioElement.play().catch(() => {});
  $("#practiceBody").innerHTML = sectionData.contentList.map(renderQuestionBlock).join("");
  prepareControls();
  $("#practiceBody").querySelectorAll(".analysis-panel").forEach((item) => { item.hidden = true; });
  $("#resultSummary").hidden = true;
  $("#answerReview").hidden = true;
  updateQuestionDots();
  if (showResult) {
    examElapsed = Number(state.progress[sectionKey(section)]?.elapsed) || 0;
    checkAnswers(true);
  } else {
    const key = sectionKey(section);
    const previous = state.progress[key] || {};
    pauseExamTimer();
    examElapsed = resumeSaved ? Number(previous.elapsed) || 0 : 0;
    state.progress[key] = { ...previous, started: true, checked: false, complete: false, elapsed: examElapsed, date: localDate() };
    saveState();
    resumeExamTimer();
  }
}

let examTimerId;
let examStartedAt = 0;
let examElapsed = 0;
function examElapsedSeconds() {
  return examElapsed + (examTimerId ? (Date.now() - examStartedAt) / 1000 : 0);
}

function paintExamTimer() {
  $("#examTimer").textContent = formatTime(examElapsedSeconds()).replace(":", " : ");
}

function resumeExamTimer() {
  if (examTimerId) return;
  examStartedAt = Date.now();
  paintExamTimer();
  examTimerId = setInterval(paintExamTimer, 1000);
}

function pauseExamTimer() {
  if (examTimerId) examElapsed += (Date.now() - examStartedAt) / 1000;
  clearInterval(examTimerId);
  examTimerId = null;
  paintExamTimer();
}

function startExamTimer() {
  pauseExamTimer();
  examElapsed = 0;
  resumeExamTimer();
}

function openPractice(key, action = "start") {
  const section = allSections().find((item) => sectionKey(item) === key);
  const sectionData = accountSnapshot?.sections?.[key];
  if (!section || !sectionData) return toast("该 Section 的离线内容尚未同步");
  state.currentSection = section;
  state.currentData = sectionData;
  const rows = sectionData.bPA?.scoreList || [];
  const firstQuestion = rows[0]?.questionIndex || 1;
  const lastQuestion = rows.at(-1)?.questionIndex || rows.length;
  $("#dialogTitle").textContent = `${section.book.jianyaName} ${section.test.name}-${section.title}`;
  $("#dialogSubtitle").textContent = `Listen and answer questions ${firstQuestion}–${lastQuestion}`;
  if (action === "restart") {
    delete state.progress[key];
    saveState();
    action = "start";
  }
  dialog.showModal();
  dialog.scrollTop = 0;
  document.querySelector(".exam-dialog-card").classList.remove("showing-result");
  $("#practiceResult").hidden = true;
  $("#pauseOverlay").hidden = true;
  $("#quitOverlay").hidden = true;
  if (action === "start") {
    clearInterval(examTimerId);
    examTimerId = null;
    examElapsed = 0;
    $("#practiceWorkspace").hidden = true;
    $("#practiceStart").hidden = false;
    document.querySelectorAll(".exam-runtime-controls").forEach((item) => { item.hidden = true; });
    $("#testAudio").src = "assets/ui/sample-audio.mp3";
    $("#testAudio").currentTime = 0;
    $("#testSound span").textContent = "Play sound";
  } else renderPracticeWorkspace(action === "result", action === "continue");
}

function confirmQuitPractice() {
  const key = state.currentSection && sectionKey(state.currentSection);
  if (key && !state.progress[key]?.checked) {
    const previous = state.progress[key] || {};
    state.progress[key] = { ...previous, started: true, checked: false, complete: false, elapsed: examElapsedSeconds(), date: localDate() };
    saveState();
  }
  closePractice();
}

function closePractice() {
  clearInterval(examTimerId);
  examTimerId = null;
  $("#testAudio").pause();
  $("#practiceAudioElement").pause();
  $("#practiceResult").hidden = true;
  $("#pauseOverlay").hidden = true;
  $("#quitOverlay").hidden = true;
  document.querySelector(".exam-dialog-card").classList.remove("showing-result");
  dialog.close();
  renderCatalog();
}

function updatePracticePlayer() {
  const audio = $("#practiceAudioElement");
  const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
  $("#practiceProgress").value = duration ? (audio.currentTime / duration) * 100 : 0;
  $("#practiceTime").textContent = `${formatTime(audio.currentTime)} / ${formatTime(duration)}`;
  $("#practicePlay").textContent = audio.paused ? "▶" : "❚❚";
}

function jumpQuestion(delta) {
  const controls = [...$("#practiceBody").querySelectorAll("[data-score-code]")];
  if (!controls.length) return;
  const current = Math.max(0, controls.indexOf(document.activeElement));
  const next = controls[Math.max(0, Math.min(controls.length - 1, current + delta))];
  next.scrollIntoView({ behavior: "smooth", block: "center" });
  next.focus();
}

function formatTime(seconds) {
  const safe = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(Math.floor(safe % 60)).padStart(2, "0")}`;
}

function currentSentence() {
  return intensiveState.data?.sentence?.[intensiveState.index];
}

function renderIntensiveText() {
  const sentence = currentSentence();
  const sentences = intensiveState.data?.sentence || [];
  const textPanel = document.querySelector(".intensive-text");
  const fullMode = intensiveState.mode === "full";
  const englishText = $("#englishText");
  const chineseText = $("#chineseText");
  const fullTextList = $("#fullTextList");
  document.querySelector(".intensive-main").classList.toggle("full-mode", fullMode);
  textPanel.classList.toggle("full-mode", fullMode);
  textPanel.classList.toggle("full-copy-visible", fullMode && intensiveState.fullTextRevealed);
  $("#shortcutOriginal").textContent = fullMode ? "显示原文" : "显示 / 隐藏原文";
  $("#shortcutTranslation").textContent = fullMode ? "显示译文" : "显示 / 隐藏译文";
  $("#sentenceCounter").textContent = `${intensiveState.index + 1} / ${sentences.length}`;
  const promptHtml = (key, label, fullText = false) => fullText
    ? `<button type="button" tabindex="-1">点击显示原文</button>`
    : `<button type="button" tabindex="-1">点击此处</button><span>或使用快捷键</span><span class="prompt-key">${key} ${label}</span>`;
  if (fullMode) {
    englishText.hidden = intensiveState.fullTextRevealed;
    chineseText.hidden = true;
    englishText.classList.add("prompt-row");
    englishText.innerHTML = promptHtml("↑", "显示原文", true);
    fullTextList.hidden = !intensiveState.fullTextRevealed;
    fullTextList.innerHTML = intensiveState.fullTextRevealed ? sentences.map((item, index) => `
      <li class="${index === intensiveState.index ? "active" : ""}" data-sentence-index="${index}">
        <span class="full-text-number">${index + 1}:<i title="笔记">✎</i></span>
        <div class="full-text-copy">
          <p class="full-text-en"${intensiveState.showEn ? "" : " hidden"}>${safeHtml(item.entext)}</p>
          <p class="full-text-cn"${intensiveState.showCn ? "" : " hidden"}>${safeHtml(item.cntext)}</p>
        </div>
      </li>`).join("") : "";
  } else {
    const englishPrompt = !intensiveState.showEn;
    const chinesePrompt = intensiveState.showEn && !intensiveState.showCn;
    englishText.hidden = false;
    chineseText.hidden = false;
    fullTextList.hidden = true;
    fullTextList.innerHTML = "";
    englishText.classList.toggle("prompt-row", englishPrompt);
    chineseText.classList.toggle("prompt-row", chinesePrompt);
    englishText.innerHTML = englishPrompt ? promptHtml("↑", "显示原文") : safeHtml(sentence?.entext || "");
    chineseText.innerHTML = intensiveState.showCn ? safeHtml(sentence?.cntext || "") : chinesePrompt ? promptHtml("↓", "显示译文") : "";
  }
  $("#sentenceList").querySelectorAll("li").forEach((item, index) => item.classList.toggle("active", index === intensiveState.index));
  document.querySelectorAll("[data-int-mode]").forEach((button) => button.classList.toggle("active", button.dataset.intMode === intensiveState.mode));
}

function updateIntensiveTime() {
  const duration = Number.isFinite(intensiveAudio.duration) ? intensiveAudio.duration : 0;
  const elapsed = Math.min(duration, Math.max(0, intensiveAudio.currentTime));
  $("#intensiveProgress").value = duration ? (elapsed / duration) * 100 : 0;
  $("#intensiveTime").textContent = `${formatTime(elapsed)} / ${formatTime(duration)}`;
  $("#intensivePlay").textContent = intensiveAudio.paused ? "▶" : "❚❚";
}

function selectSentence(index, autoplay = false) {
  const sentences = intensiveState.data?.sentence || [];
  const shouldPlay = autoplay || !intensiveAudio.paused;
  intensiveState.index = Math.max(0, Math.min(sentences.length - 1, index));
  intensiveState.repeatCount = 0;
  if (intensiveState.mode === "sentence") {
    intensiveState.showEn = false;
    intensiveState.showCn = false;
  }
  intensiveAudio.pause();
  intensiveAudio.currentTime = Number(currentSentence()?.start) || 0;
  renderIntensiveText();
  updateIntensiveTime();
  $("#sentenceList").querySelector("li.active")?.scrollIntoView({ block: "nearest" });
  if (shouldPlay) intensiveAudio.play().catch(() => {});
}

function toggleIntensivePlay(replay = false) {
  const sentence = currentSentence();
  if (!sentence) return;
  if (replay) {
    intensiveState.repeatCount = 0;
    intensiveAudio.currentTime = intensiveState.mode === "sentence" ? Number(sentence.start) : 0;
    return intensiveAudio.play();
  }
  if (!intensiveAudio.paused) return intensiveAudio.pause();
  if (intensiveState.mode === "sentence") {
    const start = Number(sentence.start);
    const end = Number(sentence.end);
    if (intensiveAudio.currentTime < start || intensiveAudio.currentTime >= end) intensiveAudio.currentTime = start;
  }
  intensiveState.repeatCount = 0;
  intensiveAudio.play();
}

function setIntensiveMode(mode) {
  intensiveState.mode = mode;
  intensiveState.repeatCount = 0;
  intensiveState.showEn = false;
  intensiveState.showCn = false;
  intensiveState.fullTextRevealed = false;
  intensiveAudio.pause();
  intensiveAudio.currentTime = mode === "sentence" ? Number(currentSentence()?.start) || 0 : 0;
  renderIntensiveText();
  updateIntensiveTime();
}

function openIntensive(key, mode = "sentence") {
  const section = allSections().find((item) => sectionKey(item) === key);
  const data = section && accountSnapshot?.intensive?.[String(section.listenId)];
  const sectionData = section && accountSnapshot?.sections?.[key];
  if (!section || !data?.sentence?.length) return toast("该 Section 的精听内容尚未同步");
  intensiveState.section = section;
  intensiveState.data = data;
  intensiveState.index = 0;
  intensiveState.mode = mode;
  intensiveState.repeat = Number($("#repeatMode").value);
  intensiveState.speed = Number($("#speedMode").value);
  intensiveState.repeatCount = 0;
  intensiveState.showEn = false;
  intensiveState.showCn = false;
  intensiveState.fullTextRevealed = false;
  $("#intensiveTitle").textContent = `${section.book.jianyaName} ${section.test.name}-${section.title}`;
  const audio = data.audioUrl || audioFrom(sectionData);
  intensiveAudio.src = audio || "";
  intensiveAudio.playbackRate = intensiveState.speed;
  $("#downloadAudio").href = audio || "#";
  $("#downloadAudio").download = `${section.book.jianyaName}-${section.test.name}-${section.title}.mp3`;
  $("#sentenceList").innerHTML = data.sentence.map((sentence, index) => `<li><button type="button" data-sentence-index="${index}"><span>第${sentence.sortNum || index + 1}句 — </span><small>${(Number(sentence.end) - Number(sentence.start)).toFixed(2)}s</small></button></li>`).join("");
  $("#correctionPanel").hidden = true;
  $("#intensiveTutorial").hidden = localStorage.getItem("ielts-intensive-help-seen") === "1";
  intensiveDialog.showModal();
  selectSentence(0);
  setIntensiveMode(mode);
}

function closeIntensive() {
  intensiveAudio.pause();
  intensiveDialog.close();
}

let toastTimer;
function toast(message) {
  const el = $("#toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 1800);
}

document.addEventListener("click", (event) => {
  if (event.target.closest("[data-close-banner]")) return $("#topBanner").remove();
  if (event.target.closest("[data-scroll-practice]")) return document.querySelector(".hero-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
  const mode = event.target.closest("[data-mode]");
  if (mode) { state.mode = mode.dataset.mode; return renderCatalog(); }
  const book = event.target.closest("[data-book]");
  if (book) { state.bookId = book.dataset.book; return renderCatalog(); }
  const intensiveTopic = event.target.closest("[data-intensive-topic]");
  if (intensiveTopic) { state.intensiveTopicIndex = Number(intensiveTopic.dataset.intensiveTopic); return renderCatalog(); }
  const sectionGroup = event.target.closest("[data-section-group]");
  if (sectionGroup) { state.sectionId = sectionGroup.dataset.sectionGroup; return renderCatalog(); }
  const topicGroup = event.target.closest("[data-topic-group]");
  if (topicGroup) { state.topicId = topicGroup.dataset.topicGroup; return renderCatalog(); }
  const testCard = event.target.closest("[data-open-test]");
  if (testCard) {
    state.bookId = testCard.dataset.openBook;
    renderCatalog();
    document.querySelector(`[data-book="${state.bookId}"]`)?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    return document.querySelectorAll(".test-table")[Number(testCard.dataset.openTest)]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  if (event.target.closest("[data-open-intensive-catalog]")) {
    state.mode = "intensiveCatalog";
    if (state.bookId === "0") state.bookId = String(catalog.books[0].jianyaId);
    return renderCatalog();
  }
  const practice = event.target.closest("[data-practice]");
  if (practice) return openPractice(practice.dataset.practice, practice.dataset.practiceAction);
  const intensive = event.target.closest("[data-intensive]");
  if (intensive) return openIntensive(intensive.dataset.intensive, intensive.dataset.intOpenMode);
  const sentence = event.target.closest("[data-sentence-index]");
  if (sentence) return selectSentence(Number(sentence.dataset.sentenceIndex), true);
  const intMode = event.target.closest("[data-int-mode]");
  if (intMode) return setIntensiveMode(intMode.dataset.intMode);
  if (event.target.closest("[data-prev-sentence]")) return selectSentence(intensiveState.index - 1);
  if (event.target.closest("[data-next-sentence]")) return selectSentence(intensiveState.index + 1);
  if (event.target.closest("[data-toggle-en]")) { intensiveState.showEn = !intensiveState.showEn; return renderIntensiveText(); }
  if (event.target.closest("[data-toggle-cn]")) { intensiveState.showCn = !intensiveState.showCn; return renderIntensiveText(); }
  if (event.target.closest("[data-end-intensive]")) return closeIntensive();
  if (event.target.closest("[data-question-favorite]")) {
    const key = sectionKey(state.currentSection);
    const saved = JSON.parse(localStorage.getItem("ielts-local-question-favorites") || "[]");
    const next = saved.includes(key) ? saved.filter((item) => item !== key) : [...saved, key];
    localStorage.setItem("ielts-local-question-favorites", JSON.stringify(next));
    event.target.textContent = next.includes(key) ? "★ 已收藏本题" : "★ 收藏本题";
    return;
  }
  if (event.target.closest("[data-favorite-sentence]")) {
    const key = `${intensiveState.section.listenId}:${intensiveState.index}`;
    const saved = JSON.parse(localStorage.getItem("ielts-local-sentence-favorites") || "[]");
    const next = saved.includes(key) ? saved.filter((item) => item !== key) : [...saved, key];
    localStorage.setItem("ielts-local-sentence-favorites", JSON.stringify(next));
    event.target.textContent = next.includes(key) ? "★ 已收藏本句" : "★ 收藏本句";
    return;
  }
  if (event.target.closest("[data-question-correction]")) { correctionContext = "question"; return $("#correctionPanel").hidden = false; }
  if (event.target.closest("[data-correction]")) { correctionContext = "intensive"; return $("#correctionPanel").hidden = false; }
  if (event.target.closest("[data-close-correction]")) return $("#correctionPanel").hidden = true;
  if (event.target.closest("[data-submit-correction]")) {
    const correctionText = $("#correctionText").value.trim();
    if (!correctionText) return toast("请填写错误描述");
    const corrections = JSON.parse(localStorage.getItem("ielts-local-corrections") || "[]");
    corrections.push(correctionContext === "question"
      ? { questionId: sectionKey(state.currentSection), type: $("#correctionType").value, text: correctionText, date: localDate() }
      : { listenId: intensiveState.section.listenId, sentence: intensiveState.index + 1, type: $("#correctionType").value, text: correctionText, date: localDate() });
    localStorage.setItem("ielts-local-corrections", JSON.stringify(corrections));
    $("#correctionText").value = "";
    $("#correctionPanel").hidden = true;
    return toast("感谢您的提交");
  }
  if (event.target.closest("[data-close-tutorial]")) {
    localStorage.setItem("ielts-intensive-help-seen", "1");
    return $("#intensiveTutorial").hidden = true;
  }
});

$("#practiceBody").addEventListener("input", (event) => syncControl(event.target));
$("#practiceBody").addEventListener("change", (event) => syncControl(event.target));
$("#practiceBody").addEventListener("click", (event) => {
  const option = event.target.closest("[data-drag-option]");
  if (option) {
    const block = option.closest(".drag-block");
    block.dataset.selectedDrag = option.dataset.dragOption;
    block.querySelectorAll("[data-drag-option]").forEach((item) => item.classList.toggle("selected", item === option));
    return;
  }
  const drop = event.target.closest(".droparea");
  if (!drop) return;
  const selected = drop.closest(".drag-block").dataset.selectedDrag;
  if (selected) setDropAnswer(drop, selected);
  else if (drop.value) setDropAnswer(drop, "");
});
$("#practiceBody").addEventListener("dragstart", (event) => {
  const option = event.target.closest("[data-drag-option]");
  if (option) event.dataTransfer.setData("text/plain", option.dataset.dragOption);
});
$("#practiceBody").addEventListener("dragover", (event) => {
  if (event.target.closest(".droparea")) event.preventDefault();
});
$("#practiceBody").addEventListener("drop", (event) => {
  const drop = event.target.closest(".droparea");
  if (!drop) return;
  event.preventDefault();
  setDropAnswer(drop, event.dataTransfer.getData("text/plain"));
});
$("#questionDots").addEventListener("click", (event) => {
  const button = event.target.closest("[data-question-row]");
  if (!button) return;
  const entry = groupRows(state.currentData?.bPA?.scoreList || [])[Number(button.dataset.questionRow)];
  const controls = entry ? controlsFor(entry.row.scoreCode) : [];
  const control = controls.find((item) => Number(item.dataset.answerIndex) === Number(entry?.row.arrayIndex) && item.checked)
    || controls.find((item) => Number(item.dataset.answerIndex) === Number(entry?.row.arrayIndex))
    || controls[entry?.occurrence || 0];
  control?.scrollIntoView({ behavior: "smooth", block: "center" });
  control?.focus();
});
$("#quitPractice").addEventListener("click", () => {
  if (!$("#practiceWorkspace").hidden && !state.progress[sectionKey(state.currentSection)]?.checked) {
    pauseExamTimer();
    $("#practiceAudioElement").pause();
    $("#pausePractice").textContent = "继续答题";
    $("#quitOverlay").hidden = false;
  } else closePractice();
});
$("#continuePractice").addEventListener("click", () => {
  $("#testAudio").pause();
  $("#testAudio").currentTime = 0;
  renderPracticeWorkspace(false);
});
$("#testSound").addEventListener("click", () => {
  const audio = $("#testAudio");
  if (audio.paused) { audio.currentTime = 0; audio.play(); } else audio.pause();
});
const updateTestSound = () => { $("#testSound span").textContent = $("#testAudio").paused ? "Play sound" : "Stop sound"; };
$("#testAudio").addEventListener("play", updateTestSound);
$("#testAudio").addEventListener("pause", updateTestSound);
$("#testAudio").addEventListener("ended", updateTestSound);
$("#checkAnswers").addEventListener("click", () => checkAnswers(false));
$("#practicePlay").addEventListener("click", () => {
  const audio = $("#practiceAudioElement");
  if (audio.paused) audio.play(); else audio.pause();
});
$("#practiceProgress").addEventListener("input", (event) => {
  const audio = $("#practiceAudioElement");
  if (Number.isFinite(audio.duration)) audio.currentTime = audio.duration * Number(event.target.value) / 100;
});
$("#practiceVolume").addEventListener("input", (event) => {
  $("#practiceAudioElement").volume = Number(event.target.value);
  $("#testAudio").volume = Number(event.target.value);
});
$("#practiceAudioElement").addEventListener("timeupdate", updatePracticePlayer);
$("#practiceAudioElement").addEventListener("loadedmetadata", updatePracticePlayer);
$("#practiceAudioElement").addEventListener("play", updatePracticePlayer);
$("#practiceAudioElement").addEventListener("pause", updatePracticePlayer);
$("#pausePractice").addEventListener("click", () => {
  pauseExamTimer();
  $("#practiceAudioElement").pause();
  $("#pausePractice").textContent = "继续答题";
  $("#pauseOverlay").hidden = false;
});
$("#resumePractice").addEventListener("click", () => {
  $("#pauseOverlay").hidden = true;
  $("#pausePractice").textContent = "暂停答题";
  resumeExamTimer();
});
$("#cancelQuit").addEventListener("click", () => {
  $("#quitOverlay").hidden = true;
  $("#pausePractice").textContent = "暂停答题";
  resumeExamTimer();
});
$("#confirmQuit").addEventListener("click", confirmQuitPractice);
$("#resultExit").addEventListener("click", closePractice);
$("#resultIntensive").addEventListener("click", () => {
  const key = sectionKey(state.currentSection);
  closePractice();
  openIntensive(key, "full");
});
$("#resultNext").addEventListener("click", () => {
  const sections = allSections();
  const next = sections[sections.findIndex((section) => sectionKey(section) === sectionKey(state.currentSection)) + 1];
  closePractice();
  if (next) openPractice(sectionKey(next), "start");
});
$("#viewQuestionDetails").addEventListener("click", () => {
  $("#practiceResult").hidden = true;
  document.querySelector(".exam-dialog-card").classList.remove("showing-result");
  document.querySelectorAll(".exam-runtime-controls").forEach((item) => { item.hidden = false; });
  $("#pausePractice").hidden = true;
  $("#checkAnswers").hidden = true;
  $("#practiceBody").querySelectorAll("input,select,button.droparea,button.option-item").forEach((control) => { control.disabled = true; });
  $("#resultSummary").hidden = true;
  $("#answerReview").hidden = false;
});
$("#previousQuestion").addEventListener("click", () => jumpQuestion(-1));
$("#nextQuestion").addEventListener("click", () => jumpQuestion(1));
$("#clearSection").addEventListener("click", () => {
  if (!state.currentSection || !confirm("确定清空本 Section 已填写的答案吗？")) return;
  delete state.progress[sectionKey(state.currentSection)];
  saveState();
  renderPracticeWorkspace(false);
});
$("#intensivePlay").addEventListener("click", () => toggleIntensivePlay());
$("#englishText").addEventListener("click", () => {
  if (intensiveState.mode === "full" && !intensiveState.fullTextRevealed) {
    intensiveState.fullTextRevealed = true;
    intensiveState.showEn = true;
    intensiveState.showCn = true;
  } else {
    intensiveState.showEn = !intensiveState.showEn;
  }
  renderIntensiveText();
});
$("#chineseText").addEventListener("click", () => { intensiveState.showCn = !intensiveState.showCn; renderIntensiveText(); });
$("#repeatMode").addEventListener("change", (event) => { intensiveState.repeat = Number(event.target.value); intensiveState.repeatCount = 0; });
$("#speedMode").addEventListener("change", (event) => { intensiveState.speed = Number(event.target.value); intensiveAudio.playbackRate = intensiveState.speed; });
$("#intensiveProgress").addEventListener("input", (event) => {
  if (Number.isFinite(intensiveAudio.duration)) intensiveAudio.currentTime = intensiveAudio.duration * Number(event.target.value) / 100;
});
intensiveAudio.addEventListener("timeupdate", () => {
  const sentence = currentSentence();
  if (intensiveState.mode === "sentence" && sentence && intensiveAudio.currentTime >= Number(sentence.end) - 0.03) {
    const shouldRepeat = intensiveState.repeat === 0 || intensiveState.repeatCount + 1 < intensiveState.repeat;
    if (shouldRepeat) {
      intensiveState.repeatCount += 1;
      intensiveAudio.currentTime = Number(sentence.start);
      if (!intensiveAudio.paused) intensiveAudio.play();
    } else {
      intensiveAudio.pause();
      intensiveState.repeatCount = 0;
      intensiveAudio.currentTime = Number(sentence.end);
    }
  } else if (intensiveState.mode === "full") {
    const index = (intensiveState.data?.sentence || []).findIndex((item) => intensiveAudio.currentTime >= Number(item.start) && intensiveAudio.currentTime < Number(item.end));
    if (index >= 0 && index !== intensiveState.index) {
      intensiveState.index = index;
      $("#sentenceList").querySelectorAll("li").forEach((item, itemIndex) => item.classList.toggle("active", itemIndex === index));
      $("#fullTextList").querySelectorAll("li").forEach((item, itemIndex) => item.classList.toggle("active", itemIndex === index));
      $("#fullTextList li.active")?.scrollIntoView({ block: "center" });
    }
  }
  updateIntensiveTime();
});
intensiveAudio.addEventListener("play", updateIntensiveTime);
intensiveAudio.addEventListener("pause", updateIntensiveTime);
intensiveAudio.addEventListener("loadedmetadata", updateIntensiveTime);

document.addEventListener("keydown", (event) => {
  if (!intensiveDialog.open || ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) return;
  if (event.code === "Space") { event.preventDefault(); toggleIntensivePlay(); }
  else if (event.key === "Shift") { event.preventDefault(); toggleIntensivePlay(true); }
  else if (event.key === "ArrowLeft") { event.preventDefault(); selectSentence(intensiveState.index - 1); }
  else if (event.key === "ArrowRight") { event.preventDefault(); selectSentence(intensiveState.index + 1); }
  else if (event.key === "ArrowUp") { event.preventDefault(); intensiveState.showEn = !intensiveState.showEn; renderIntensiveText(); }
  else if (event.key === "ArrowDown") { event.preventDefault(); intensiveState.showCn = !intensiveState.showCn; renderIntensiveText(); }
});

if (!catalog?.books?.length) {
  content.innerHTML = `<div class="empty">本地目录数据缺失，请先运行同步脚本。</div>`;
} else {
  renderCatalog();
}
