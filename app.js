"use strict";
const asset = (n) => "assets/" + n + ".webp";
const photos = ["person", "jacket", "street", "suit", "preppy", "boho"].map(
  asset,
);
const styles = [
  ["帮我挑一套", "为你挑一套意想不到的穿搭。", "cloud", "suit"],
  ["极简风", "利落的线条，柔和的中性色。", "suit", "suit"],
  ["现代学院风", "衬衫与百褶裙，穿出清爽的学院感。", "preppy", "preppy"],
  ["哥特浪漫", "深色调搭配蕾丝细节。", "gothic", "gothic"],
  [
    "街头混搭",
    "用休闲牛仔混搭不同质感。",
    "street",
    "street",
  ],
  ["波西米亚风", "柔软的叠穿，搭配自然色调。", "boho", "boho"],
  ["千禧未来感", "银色点缀，搭配俏皮的廓形。", "future", "future"],
  ["自定义风格", "用一句话描述你想尝试的穿搭。", "cloud", "suit"],
];
const icons = {
  Wardrobe: '<path d="M5 3h14v18l-7-4-7 4z" fill="currentColor"/>',
  Calendar:
    '<rect x="3" y="4" width="18" height="17" rx="3"/><path d="M3 9h18m-13 4h1m4 0h1m-6 4h1m4 0h1"/>',
  Generator:
    '<path d="m12 2 3 6.4 7 1-5 5 1.2 7-6.2-3.3-6.2 3.3 1.2-7-5-5 7-1Z" fill="currentColor"/>',
  "Try On":
    '<path d="m13 5 2.4 6.6L22 14l-6.6 2.3L13 23l-2.4-6.7L4 14l6.6-2.4zM5 1l1.1 3L9 5l-2.9 1L5 9 4 6 1 5l3-1z" fill="currentColor"/>',
  Profile:
    '<circle cx="12" cy="7" r="4" fill="currentColor"/><path d="M4 21v-2a8 7 0 0 1 16 0v2Z" fill="currentColor"/>',
  help: '<path d="M7.8 8a4.2 4.2 0 0 1 8.4 0c0 3.2-4.2 3.5-4.2 7" stroke-width="2.6" stroke-linecap="round"/><circle cx="12" cy="19.5" r="1.4" fill="currentColor" stroke="none"/>',
  back: '<path d="m15 4-8 8 8 8"/>',
  next: '<path d="m9 5 7 7-7 7"/>',
  more: '<circle cx="4" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="20" cy="12" r="1"/>',
  camera:
    '<rect x="2" y="6" width="20" height="14" rx="3"/><circle cx="12" cy="13" r="3.5"/><path d="m7 6 2-3h6l2 3"/>',
};
const icon = (k) =>
  '<svg class="symbol" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' +
  icons[k] +
  "</svg>";
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const el = (id) => document.getElementById(id);
const tabs = ["Wardrobe", "Calendar", "Generator", "Try On", "Profile"];
const labels = {Wardrobe:"衣橱", Calendar:"日历", Generator:"穿搭生成", "Try On":"试穿", Profile:"我的", All:"全部", Uploads:"已上传"};
const cloud = window.cloudWardrobe;
const guestKey = "wardrobe-studio-prototype-v1";
let key = guestKey, account = null, revision = 0;
let saving = Promise.resolve();
const legacyStyles = ["Surprise Me", "Minimalist", "Modern Preppy", "Gothic Romance", "Elevated Streetwear", "Modern Bohemian", "Y2K Futurism"];
const fresh = () => ({
  name: "穿搭探索者",
  avatar: "",
  credit: 1,
  items: [],
  plans: {},
  job: null,
  signed: true,
});
function load() {
  if (account) return structuredClone(db);
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    if (!saved) return fresh();
    if (saved.name === "Style Explorer") saved.name = "穿搭探索者";
    for (const item of saved.items) {
      if (item.type === "Try On" && item.title === "Virtual Try-On") item.title = "虚拟试穿";
      if (item.type === "Uploads" && item.title === "Person photo") item.title = "人物照";
      if (item.type === "Uploads" && item.title === "Clothing item") item.title = "衣物图";
      if (item.type === "Generator") {
        const index = legacyStyles.indexOf(item.title);
        if (index >= 0 && item.src === asset(styles[index][3])) item.title = styles[index][0];
      }
    }
    return saved;
  } catch {
    return fresh();
  }
}
let db = load(),
  tab = "Try On",
  screen = "home",
  filter = "All",
  itemId = "",
  marked = "",
  mode = "week",
  stepDate = dayKey(new Date()),
  toastTimer;
let drafts = {};
let editingChoice = false;
const creatorTabs = ["Try On", "Generator"];
const draftKey = (type) => key + "-draft-" + type;
const draftTabKey = () => key + "-draft-tab";
const unsavedDrafts = new Set();
function draft() {
  return (drafts[tab] ??= {
    person: "",
    garment: "",
    style: 0,
    custom: "",
    step: 1,
  });
}
function restoreDrafts() {
  try {
    for (const type of creatorTabs) {
      const saved = JSON.parse(sessionStorage.getItem(draftKey(type)));
      if (saved && typeof saved.person === "string" && typeof saved.garment === "string" &&
          typeof saved.custom === "string" && styles[saved.style] &&
          [1, 2].includes(saved.step)) drafts[type] = saved;
    }
    const active = sessionStorage.getItem(draftTabKey());
    if (creatorTabs.includes(active) && drafts[active]) tab = active;
  } catch {
    // A tab without readable storage can still use the in-memory editor.
  }
}
function saveDraft() {
  try {
    sessionStorage.setItem(draftKey(tab), JSON.stringify(draft()));
    sessionStorage.setItem(draftTabKey(), tab);
    unsavedDrafts.delete(tab);
  } catch {
    unsavedDrafts.add(tab);
    notice("草稿暂时无法保存，刷新前请先完成本次搭配。");
  }
}
function forgetDraft(type) {
  unsavedDrafts.delete(type);
  try {
    sessionStorage.removeItem(draftKey(type));
  } catch {
    // The page can still finish editing when session storage is unavailable.
  }
}
function rememberDraftTab(type) {
  try {
    if (creatorTabs.includes(type)) sessionStorage.setItem(draftTabKey(), type);
    else sessionStorage.removeItem(draftTabKey());
  } catch {
    // Navigation also works without a saved tab.
  }
}
function clearDrafts() {
  drafts = {};
  creatorTabs.forEach(forgetDraft);
  rememberDraftTab(null);
  editingChoice = false;
}
window.addEventListener("beforeunload", (event) => {
  if (unsavedDrafts.size) {
    event.preventDefault();
    event.returnValue = true;
  }
});
async function commit(change) {
  if (account) {
    async function write() {
      const next = structuredClone(db);
      change(next);
      try {
        const saved = cloud ? await cloud.saveProfile(account.id,next,revision) : await jobRequest("/api/account/wardrobe", {
          method:"PUT", body:JSON.stringify({revision,wardrobe:next}), headers:{"Content-Type":"application/json"}
        });
        db = next;
        revision = saved.revision;
        return true;
      } catch (error) {
        if (error.status === 401) location.reload();
        if (error.status === 409) {
          const current = cloud ? await cloudSnapshot() : await jobRequest("/api/auth/me");
          db = current.wardrobe;
          revision = current.revision;
          render();
        }
        notice(error.message || "衣橱保存失败，请重试。");
        return false;
      }
    }
    saving = saving.then(write,write);
    return saving;
  }
  const next = load();
  change(next);
  try {
    localStorage.setItem(key, JSON.stringify(next));
    db = next;
    return true;
  } catch {
    notice("浏览器存储空间已满，请移除不需要的造型后重试。");
    return false;
  }
}
function dayKey(d) {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}
function dateOf(k) {
  return new Date(k + "T12:00:00");
}
function shiftDay(k, n) {
  let d = dateOf(k);
  d.setDate(d.getDate() + n);
  return dayKey(d);
}
function labelDate(
  k,
  opts = { day: "numeric", month: "short", year: "numeric" },
) {
  return dateOf(k).toLocaleDateString("zh-CN", opts);
}
function notice(s) {
  el("notice").textContent = s;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el("notice").textContent = ""), 3000);
}
const button = (text, action, cls = "secondary", extra = "") =>
  '<button class="' +
  cls +
  '" data-action="' +
  action +
  '" ' +
  extra +
  ">" +
  text +
  "</button>";
const img = (src, alt, cls = "cover") =>
  '<img class="' + cls + '" src="' + esc(cloud ? cloud.imageUrl(src) : src) + '" alt="' + esc(alt) + '">';
const find = (id) => db.items.find((i) => i.id === id);
function modal(title, body) {
  let s = el("sheet");
  s.innerHTML =
    button("×", "close", "close", 'aria-label="关闭"') +
    "<h2>" +
    esc(title) +
    "</h2>" +
    body;
  if (!s.open) s.showModal();
}
function close() {
  if (el("sheet").open) el("sheet").close();
}
function go(t) {
  close();
  editingChoice = false;
  tab = t;
  rememberDraftTab(t);
  screen = "home";
  marked = "";
  if (db.job?.type === t) screen = "wait";
  render();
  if (t === "Wardrobe") refreshGarments();
}
let cloudRead = 0;
async function refreshGarments() {
  if (!cloud || !account) return;
  const request = ++cloudRead;
  try {
    const items = await cloud.garments(account.id);
    if (request !== cloudRead) return;
    db.items = items;
    if (tab === "Wardrobe" && !el("sheet").open) render();
  } catch { notice("衣橱同步失败，请重新打开衣橱。"); }
}
function openItem(id, view = "detail") {
  itemId = id;
  screen = view;
  close();
  render();
}
function render() {
  document.title = labels[tab] + " · 我的衣橱";
  let creator = tab === "Generator" || tab === "Try On";
  const badge =
    tab === "Try On"
      ? '<span class="badge" lang="en">Try On</span>'
      : tab === "Generator"
        ? '<span class="brand gen" lang="en">Outfit Generator<i aria-hidden="true">·</i></span>'
        : tab === "Calendar"
          ? '<span class="badge cal" lang="en">Calendar</span>'
          : tab === "Profile"
            ? '<span class="brand" lang="en">Profile</span>'
            : '<span class="brand" lang="en"><small>My</small>Wardrobe</span>';
  let left =
    screen === "detail" ||
    screen === "result" ||
    (creator && screen === "home" && draft().step === 2)
      ? button(icon("back"), "back", "round head-left", 'aria-label="返回"')
      : tab === "Calendar"
        ? button(
            mode === "week" ? "月视图" : "周视图",
            "toggle-month",
            "head-left head-text",
          )
        : "";
  el("header").innerHTML =
    left +
    badge +
    button(icon("help"), "help", "round head-right", 'aria-label="衣橱使用指南" title="衣橱使用指南"');
  el("nav").innerHTML = tabs
    .map((t, i) =>
      button(
        icon(t) + "<span>" + labels[t] + "</span>",
        "nav:" + i,
        t === tab ? "active" : "",
        t === tab ? 'aria-current="page"' : "",
      ),
    )
    .join("");
  if (!db.signed) {
    el("page").innerHTML =
      '<div class="empty"><h1>我的衣橱</h1><p>登录后可以找回自己的造型和日历安排。</p>' +
      button("登录", "signin", "primary") + button("注册账号", "register") + button("继续以访客身份使用", "guest") +
      "</div>";
    return;
  }
  let html;
  if (screen === "wait" && db.job) html = waitView();
  else if ((screen === "result" || screen === "detail") && find(itemId))
    html = detailView(find(itemId));
  else if (creator) html = flowView();
  else if (tab === "Wardrobe") html = wardrobeView();
  else if (tab === "Calendar") html = calendarView();
  else html = profileView();
  el("page").innerHTML = html;
  window.scrollTo(0, 0);
}
function photoCard(slot, src) {
  let person = slot === "person",
    samples = person
      ? [photos[2], photos[0], photos[4]]
      : [photos[1], photos[2], photos[1]];
  return (
    '<button class="photo-card" data-action="select:' +
    slot +
    '" aria-label="选择' +
    (person ? "人物照" : "衣物图") +
    '">' +
    (src
      ? img(src, "已选照片") +
        '<span class="replace">' +
        icon("camera") +
        "</span>"
      : '<span class="card-copy">上传' +
        (person ? "一张人物照" : "一张衣物图") +
        '<small>轻点上传</small></span><span class="scribble">示例</span><span class="film">' +
        samples.map((s) => img(s, "示例照片")).join("") +
        "</span>") +
    "</button>"
  );
}
function flowView() {
  const d = draft(),
    first = d.step === 1,
    isTry = tab === "Try On";
  let slot = first ? "person" : "garment",
    isStyle = !first && !isTry,
    style = styles[d.style];
  let title = first
    ? isTry
      ? "看看衣服<br>穿上身的样子"
      : "找到适合你的<br>穿搭风格"
    : isTry
      ? "想试穿<br>哪件衣服？"
      : "选一种<br>穿搭风格";
  let card = isStyle
    ? '<div class="style-wrap"><div class="style-card" tabindex="0" role="group" aria-label="' +
      style[0] + '，第 ' + (d.style + 1) + ' 种，共 ' + styles.length + ' 种，左右方向键切换">' +
      img(asset(style[2]), style[0]) +
      '<div class="style-label"><strong>' +
      style[0] +
      "</strong><p>" +
      style[1] +
      "</p></div></div></div>"
    : photoCard(slot, d[slot]);
  let controls = isStyle
    ? '<div class="style-switch">' +
      button("‹", "style:-1", "", 'aria-label="上一个风格"') +
      "<span>" +
      (d.style + 1) +
      " / " +
      styles.length +
      "</span>" +
      button("›", "style:1", "", 'aria-label="下一个风格"') +
      "</div>"
    : "";
  if (isStyle && d.style === 7)
    controls +=
      '<input id="custom" maxlength="50" class="text-input" placeholder="例如：适合周末出游的复古穿搭" value="' +
      esc(d.custom) +
      '" aria-label="自定义风格">';
  let valid = first
    ? d.person
    : isTry
      ? d.garment
      : d.style !== 7 || d.custom.trim();
  return (
    '<div class="flow"><h1>' +
    title +
    "</h1>" +
    card +
    '<div class="flow-actions">' +
    controls +
    button(
      editingChoice ? "返回确认" : first ? "下一步 →" : isTry ? "试穿这件衣服" : "生成造型",
      first ? "next" : "generate",
      "primary",
      valid ? "" : "disabled",
    ) +
    (!first && isTry && (!cloud || account) ? devicePicker("garment", d.garment ? "从相册更换衣物" : "从相册选衣物", "secondary") : "") +
    (!first && isTry && cloud && db.items.some(i=>i.slot === "garment")
      ? button("从衣橱选择衣物","select:garment","secondary") : "") +
    (first || isTry
      ? button(
          first ? "使用示例人物照" : "使用示例衣物图",
          "sample:" + slot,
          "minor",
        )
      : "") +
    (!first && (!cloud || account)
      ? '<span class="subtle">剩余' +
        db.credit +
        " 次体验机会</span>"
      : "") +
    "</div></div>"
  );
}
let jobMessage = "";
let archiveBlocked = false;
function waitView() {
  const job = db.job;
  const pairing = job.type === "Try On" ? job.garment : asset(styles[job.style][2]);
  const pair = job.person && pairing ? '<div class="pair">' + img(job.person,"人物照") + img(pairing,job.type === "Try On" ? "衣物图" : "风格参考") + '</div>' : '';
  return '<section class="wait">' + pair + '<p role="status">'  + esc(jobMessage || "正在提交造型…") + '</p>' +
    (archiveBlocked ? button("重试保存", "retry-save", "primary") : "") +
    button("去衣橱", "nav:0", "secondary") + "</section>";
}
function detailView(it) {
  let result = it.type !== "Uploads";
  let parts = (it.parts || [])
    .map((id) => find(id))
    .map((i) =>
      i ? img(i.src, "原始照片") : "<small>原图已删除</small>",
    )
    .join("");
  return (
    '<section class="detail"><button class="look" data-action="zoom">' +
    img(it.src, it.title) +
    '</button><div class="bar">' +
    button(
      result ? "加入日历" : "使用这张照片",
      result ? "schedule:" + it.id : "reuse:" + it.id,
      "secondary",
    ) +
    button(
      icon("more"),
      "menu:" + it.id,
      "round",
      'aria-label="更多操作"',
    ) +
    "</div>" +
    (it.type === "Try On" && it.engine !== "openai" && it.parts?.length === 2 && it.parts.every(find)
      ? button("用这组素材重新试穿", "retry-tryon:" + it.id, "secondary wide") : "") +
    (screen === "result"
      ? button("在衣橱查看", "reveal", "primary wide")
      : "") +
    '<p class="meta">' +
    esc(it.title) +
    " · " +
    labelDate(it.date) +
    (result ? " · " + (it.engine === "local" ? "搭配预览" : it.engine === "openai" ? "AI 生成" : "演示效果") : "") +
    "</p>" +
    (result && parts
      ? '<h3>使用的素材</h3><div class="pieces">' + parts + "</div>"
      : "") +
    "</section>"
  );
}
function wardrobeEmpty() {
  const upload = cloud && (filter === "All" || filter === "Uploads");
  const generator = filter === "Generator";
  const sample = upload ? "jacket" : generator ? "suit" : "street";
  const title = upload ? "添加第一件衣物" : generator ? "还没有生成的穿搭" :
    filter === "Uploads" ? "还没有保存的素材" : "还没有试穿造型";
  const hint = upload ? "上传一张单件衣物照，就能在手机和电脑上查看。" :
    generator ? "选一张人物照，再挑一种喜欢的风格。" : "选好人物照和想穿的衣物，就可以开始试穿。";
  return '<section class="empty wardrobe-empty"><figure class="wardrobe-example">' +
    img(asset(sample), "", "example-photo") + '<figcaption>示例</figcaption></figure>' +
    '<div class="wardrobe-intro"><h1>' + title + '</h1><p>' + hint + '</p>' +
    button(upload ? "上传衣物图" : generator ? "选择穿搭风格" : "去试穿",
      upload ? "cloud-upload" : generator ? "nav:2" : "nav:3", "primary") +
    '</div></section>';
}
function wardrobeView() {
  let list = db.items.filter((i) => filter === "All" || i.type === filter);
  return (
    '<section class="wardrobe-home"><div class="seg" role="group" aria-label="衣橱分类">' +
    ["All", "Try On", "Generator", "Uploads"]
      .map((f) => button(labels[f], "filter:" + f, f === filter ? "chosen" : "", 'aria-pressed="' + (f === filter) + '"'))
      .join("") +
    "</div>" +
    (cloud && list.length && ["All","Uploads"].includes(filter)
      ? '<div class="wardrobe-tools">' + button("上传衣物图", "cloud-upload", "secondary") + '</div>' : "") +
    (db.job ? button("正在生成造型…", "resume", "pending") : "") +
    (list.length
      ? '<div class="grid">' +
        list
          .map(
            (i) =>
              '<article class="tile ' +
              (marked === i.id ? "focus" : "") +
              '"><button class="pic" data-action="item:' +
              i.id +
              '">' +
              img(i.src, i.title) +
              "</button><footer>" +
              labelDate(i.date).toUpperCase() +
              button("•••", "menu:" + i.id, "", 'aria-label="造型操作"') +
              "</footer></article>",
          )
          .join("") +
        "</div>"
      : wardrobeEmpty()) + "</section>"
  );
}
function calendarView() {
  let d = dateOf(stepDate),
    month = mode === "month",
    start = month ? new Date(d.getFullYear(), d.getMonth(), 1, 12) : d;
  let first = shiftDay(dayKey(start), -((start.getDay() + 6) % 7));
  let labels = ["一", "二", "三", "四", "五", "六", "日"]
    .map((s) => "<small>" + s + "</small>")
    .join("");
  let days = Array.from({ length: month ? 42 : 7 }, (_, i) => {
    let k = shiftDay(first, i),
      dt = dateOf(k),
      it = find(db.plans[k]);
    return button(
      dt.getDate() + (month && it ? img(it.src, "已安排的造型") : ""),
      "day:" + k,
      [
        k === stepDate ? "sel" : "",
        it ? "has" : "",
        month && dt.getMonth() !== d.getMonth() ? "dim" : "",
      ].join(" "),
      'aria-label="' + labelDate(k) + '"',
    );
  }).join("");
  let look = find(db.plans[stepDate]);
  let dayBody = look
    ? '<button class="look" data-action="item:' +
      look.id +
      '">' +
      img(look.src, "当天的穿搭") +
      '</button><div class="bar">' +
      button("更换造型", "choose-plan") +
      button("移除安排", "remove-plan") +
      "</div>"
    : '<div class="poster"><strong>计划<br>每日穿搭</strong>' +
      img(photos[2], "街头穿搭参考") +
      button("＋ 选择造型", "choose-plan", "primary") +
      "</div>";
  return (
    '<div class="cal-top">' +
    button("‹", "period:-1", "", 'aria-label="上一个时段"') +
    "<strong>" +
    labelDate(stepDate, { month: "long", year: "numeric" }) +
    "</strong>" +
    button("今天", "today") +
    button("›", "period:1", "", 'aria-label="下一个时段"') +
    '</div><div class="dates ' +
    mode +
    '">' +
    labels +
    days +
    "</div>" +
    (month
      ? ""
      : '<h3 class="day-title">' +
        labelDate(stepDate, {
          weekday: "long",
          day: "numeric",
          month: "short",
        }) +
        "</h3>" +
        dayBody)
  );
}
function profileView() {
  return (
    '<div class="license"><div class="portrait">' +
    (db.avatar ? img(db.avatar, "个人头像") : esc(db.name.slice(0, 1))) +
    '</div><div><h2 lang="en">Fashion<br><b>License</b></h2><dl><dt>昵称</dt><dd>' +
    esc(db.name) +
    '</dd><dt>身份</dt><dd>穿搭爱好者</dd></dl><span class="seal" lang="en">Try On</span></div></div><div class="bar">' +
    button("编辑资料", "edit-profile") +
    '</div>' +
    (cloud ? '<h3 class="section-name">账号</h3>' : '<a class="primary wide cloud-link" href="https://florencezq.github.io/askwardrobe-cloud/">打开云端衣橱</a>' +
    '<h3 class="section-name">本机账号</h3>') +
    (account ? '<div class="line">登录邮箱<span>' + esc(account.email) + '</span></div>' +
      button("退出登录", "signout", "line") :
      '<div class="line">访客衣橱<span>保存在当前浏览器</span></div>' +
      button("登录", "signin", "line") + button("注册账号", "register", "line") +
      button("删除本地资料", "delete-account", "line")) +
    '<h3 class="section-name">我的方案</h3><div class="line"><b>免费体验</b></div><div class="line"><b>剩余生成次数</b><span>' +
    db.credit +
    " / 1 次</span></div>" +
    (cloud ? "" : button("重置体验次数", "refill", "line"))

  );
}
function devicePicker(slot, text, style) {
  return '<label class="device-picker ' + style + '">' + text +
    '<input type="file" accept="image/*" data-photo-slot="' + slot +
    '" aria-label="' + text + '"></label>';
}
function chooseFile(slot) {
  const input = el("file");
  input.value = "";
  input.dataset.photoSlot = slot;
  input.click();
}
document.addEventListener("change", (event) => {
  const input = event.target;
  if (!input.matches('input[type="file"][data-photo-slot]')) return;
  const file = input.files[0];
  if (!file) return;
  input.value = "";
  close();
  readPhoto(input.dataset.photoSlot, file);
});
async function readPhoto(slot, f) {
  if (f.size > 15 * 1024 * 1024) return notice("请选择不超过 15 MB 的图片。");
  const imageType = f.type ? /^image\/(jpeg|png|webp|heic|heif|avif)$/i.test(f.type)
    : /\.(jpe?g|png|webp|heic|heif|avif)$/i.test(f.name);
  if (!imageType) return notice("请选择一张照片，例如 JPG、PNG 或 WebP 图片。");
  let url = URL.createObjectURL(f);
  try {
    let im = new Image();
    im.src = url;
    await im.decode();
    let scale = Math.min(1, 850 / Math.max(im.width, im.height));
    let c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(im.width * scale));
    c.height = Math.max(1, Math.round(im.height * scale));
    let ctx = c.getContext("2d");
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(im, 0, 0, c.width, c.height);
    let data = c.toDataURL("image/jpeg", 0.82);
    if (slot === "wardrobe") {
      const blob = await new Promise(resolve => c.toBlob(resolve,"image/jpeg",0.82));
      if (!blob) return notice("图片读取失败，请再选一次。");
      try {
        await cloud.upload(account.id,blob);
        filter = "Uploads";
        await refreshGarments();
        notice("已保存到云端衣橱");
      } catch (error) { notice(error.message); }
    } else if (slot === "avatar") {
      if (!await commit((s) => (s.avatar = data))) return;
      render();
      editProfile();
    } else {
      draft()[slot] = data;
      saveDraft();
      render();
    }
  } catch {
    notice("当前浏览器无法读取这张图。请将它导出为 JPG，或选择一张截图。");
  } finally {
    URL.revokeObjectURL(url);
  }
}
function selectPhoto(slot) {
  let items = db.items.filter((i) => i.type === "Uploads" && i.slot === slot);
  let list = items.length
    ? '<h3>从衣橱中选择</h3><div class="mini-grid">' +
      items
        .map((i) =>
          button(img(i.src, i.title), "pick:" + slot + ":" + i.id, ""),
        )
        .join("") +
      "</div>"
    : "";
  modal(
    slot === "person" ? "人物照" : "衣物图",
    "<p>" +
      (slot === "person"
        ? "请选择一张清晰的正面人物照。"
        : "请选择一张清晰的单件衣物图。") +
      '图片最大 15 MB。</p><div class="sheet-buttons">' +
      devicePicker(slot, slot === "garment" ? "从相册选衣物" : "从相册选人物照", "primary") +
      button(
        slot === "person" ? "使用示例人物照" : "使用示例衣物图",
        "sample:" + slot,
      ) +
      "</div>" +
      list,
  );
}
function editProfile() {
  modal(
    "编辑资料",
    button("更换头像", "file:avatar") +
      '<label for="nick">昵称</label><input class="text-input" id="nick" maxlength="40" value="' +
      esc(db.name) +
      '"><div class="bar">' +
      button("保存修改", "save-profile", "primary") +
      "</div>",
  );
}
function menu(id) {
  const i = find(id);
  if (!i) return;
  modal(
    i.title,
    '<div class="sheet-buttons">' +
      button("下载图片", "download:" + id, "option") +
      (i.type === "Uploads"
        ? ""
        : button("加入日历", "schedule:" + id, "option")) +
      button("从衣橱删除", "ask-delete:" + id, "option issue") +
      "</div>",
  );
}
function plan(id, k) {
  if (!find(id)) return;
  let old = find(db.plans[k]);
  if (old && old.id !== id) {
    modal(
      "替换当天的穿搭？",
      "<p>" +
        labelDate(k) +
        ' 已有穿搭安排。</p><div class="compare">' +
        img(old.src, "当前造型") +
        img(find(id).src, "新造型") +
        '</div><div class="bar">' +
        button("取消", "close") +
        button("替换", "save-plan:" + id + ":" + k, "primary") +
        "</div>",
    );
  } else savePlan(id, k);
}
async function savePlan(id, k) {
  if (!await commit((s) => (s.plans[k] = id))) return;
  stepDate = k;
  mode = "week";
  go("Calendar");
  notice("穿搭已加入日历");
}
function reviewChoice(slot, label, src, caption = "") {
  return '<figure>' + img(src, label) + '<figcaption><strong>' +
    esc(caption || label) + '</strong>' +
    button("更换", "edit-choice:" + slot, "minor", 'aria-label="更换' + label + '"') +
    '</figcaption></figure>';
}
async function startJob() {
  const d = draft();
  if (
    !d.person ||
    d.step !== 2 ||
    (!d.garment && tab === "Try On") ||
    (tab === "Generator" && d.style === 7 && !d.custom.trim())
  )
    return;
  db = load();
  if (db.job) {
    tab = db.job.type;
    screen = "wait";
    render();
    return;
  }
  const sourceTab = tab;
  let engine;
  try {
    const config = cloud ? {tryOnEngine:"openai"} : await jobRequest("/api/config");
    engine = tab === "Try On" ? config.tryOnEngine : config.engine;
  } catch {
    notice("暂时连不上生成服务，请稍后再试。");
    return;
  }
  if (sourceTab !== tab || screen !== "home" || d !== draft()) return;
  const style = styles[d.style];
  if (editingChoice) {
    editingChoice = false;
    render();
    el("page").querySelector('[data-action="generate"]').focus();
  }
  const pairing = tab === "Try On"
    ? reviewChoice("garment", "衣物图", d.garment)
    : reviewChoice("style", "穿搭风格", asset(style[2]), d.style === 7 ? d.custom.trim() : style[0]);
  const choices = '<div class="review-choices">' + reviewChoice("person", "人物照", d.person) + pairing + '</div>';
  if (!engine) {
    if (cloud) return modal("生成服务尚未上线", choices + "<p>当前可在本机版生成上身图。</p>" + button("返回", "close", "primary wide"));
    modal("连接 AI 图像服务", choices +
      "<p>人物照和衣物选择已保留。在项目文件夹双击「配置试穿服务.command」，输入你的 OpenAI API 密钥，然后回到这里。</p>" +
      button("已配置，重新检查", "check-service", "primary wide"));
    return;
  }
  if (cloud && !account) return accountForm(false);
  if (cloud) {
    try { db.credit = (await cloud.tryOnState()).credit; }
    catch (error) { return notice(error.message); }
    if (!db.credit) return modal("当前没有可用试穿次数","<p>可以在衣橱中查看已经保存的试穿图。</p>" + button("去衣橱","nav:0","primary wide"));
  }
  if (!db.credit) {
    modal(
      "本轮体验次数已用完",
      "<p>重置次数后可以再试一套，已保存的造型仍在衣橱里。</p>" +
        button("重置体验次数", "refill", "primary"),
    );
    return;
  }
  modal(
    engine === "local" ? "生成搭配预览" : tab === "Try On" ? "确认试穿" : "生成 AI 造型",
    choices +
      (engine === "local"
        ? "<p>本机会把人物与衣物或风格参考图并排合成一张搭配图。</p>"
        : "<p>所选照片和风格将发送给 OpenAI，生成一张上身效果图。</p>") +
      "<p>本次使用 1 次体验机会，生成失败将退回。</p>" +
      button(engine === "local" ? "生成预览" : tab === "Try On" ? "生成我的上身图" : "生成造型", "submit", "primary wide", 'data-engine="' + esc(engine) + '"'),
  );
}
const cloudPendingKey = () => key + "-cloud-tryon";
let submittingCloud = false, pollingCloud = false;
async function submitCloudJob(job) {
  if (!account || submittingCloud || db.job) return;
  submittingCloud = true;
  close();
  sessionStorage.setItem(cloudPendingKey(),JSON.stringify({id:job.id,at:job.at}));
  db.job = job; screen = "wait"; jobMessage = "正在提交试穿…"; render();
  try {
    await cloud.submitTryOn(job);
    db.credit = 0;
    setJobMessage("正在制作上身图，完成后会自动存入衣橱。");
  } catch (error) {
    if (error.status >= 400 && error.status < 500) {
      db.job = null; sessionStorage.removeItem(cloudPendingKey()); screen = "home"; render();
      return notice(error.message);
    }
    setJobMessage("正在核对云端是否收到本次提交…");
  } finally { submittingCloud = false; }
  await pollCloudJob();
}
async function pollCloudJob() {
  if (!db.job || submittingCloud || pollingCloud) return;
  pollingCloud = true;
  const job = db.job;
  try {
    const state = await cloud.tryOnState();
    db.credit = state.credit;
    const row = state.latest;
    if (row?.id === job.id && row.needs_save) {
      setJobMessage("成片已生成，正在保存到衣橱…");
      await cloud.recoverTryOn(job.id);
      return;
    }
    if (row?.id === job.id && row.state === "running") {
      setJobMessage("正在制作上身图，完成后会自动存入衣橱。");
      return;
    }
    if (row?.id === job.id && row.state === "ready") {
      const items = await cloud.garments(account.id);
      if (!items.some(item=>item.id===job.id)) throw Error("正在读取成片。");
      cloudRead++;
      db.items = items;
      db.job = null; sessionStorage.removeItem(cloudPendingKey()); forgetDraft("Try On");
      if (screen === "wait") openItem(job.id,"result");
      else { render(); notice("试穿图已保存到衣橱"); }
      return;
    }
    if (row?.id !== job.id && job.at && Date.now()-job.at < 30000) return;
    db.job = null; screen = "home"; sessionStorage.removeItem(cloudPendingKey()); render();
    notice(row?.id === job.id ? row.message || "试穿未完成，请重试。" : "未找到这次提交，请重新确认。");
  } catch { setJobMessage("正在同步云端状态，恢复连接后会继续。"); }
  finally { pollingCloud = false; }
}
const pendingKey = () => key + "-pending";
function queueJob(job) {
  try {
    sessionStorage.setItem(pendingKey(), JSON.stringify(job));
  } catch {
    return notice("无法保存本次请求，请试试小一点的照片。");
  }
  close();
  const accept = async () => {
    db = load();
    if (!db.job && db.credit && !find(job.id)) {
      if (
        !await commit((s) => {
          s.job = job;
          s.credit--;
        })
      ) {
        sessionStorage.removeItem(pendingKey());
        return;
      }
      jobMessage = "";
      archiveBlocked = false;
      forgetDraft(job.type);
    }
    sessionStorage.removeItem(pendingKey());
    if (db.job) {
      tab = db.job.type;
      screen = "wait";
      render();
    } else if (find(job.id)) {
      tab = job.type;
      openItem(job.id, "result");
    } else notice("本轮体验次数已用完。");
  };
  return navigator.locks
    ? navigator.locks.request(key + "-job", accept)
    : accept();
}
async function jobRequest(path, options = {}) {
  const response = await fetch(path, {cache: "no-store", signal: AbortSignal.timeout(20000), ...options, headers:{"X-Wardrobe-Account": account?.id || "guest", ...options.headers}});
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw Object.assign(new Error(body.error || "请求失败，请重试。"), {status: response.status});
  }
  return response.json();
}
function setJobMessage(message) {
  if (jobMessage === message) return;
  jobMessage = message;
  if (screen === "wait" && db.job) el("page").innerHTML = waitView();
}
async function failJob(job, message) {
  if (!await commit(s => { s.job = null; s.credit += 1; })) return;
  tab = job.type;
  drafts[tab] = {person: job.person, garment: job.garment, style: job.style, custom: job.custom, step: 2};
  saveDraft();
  screen = "home";
  render();
  modal("本次生成未完成", "<p>" + esc(message) + "</p><p>本次次数已退回，你的选择已保留。</p>" +
    button("返回调整", "close", "primary wide"));
}
let checkingJob = false;
async function settle() {
  if (!db.job || checkingJob || archiveBlocked) return;
  checkingJob = true;
  const job = db.job;
  const path = "/api/jobs/" + job.id;
  try {
    // An older prototype may have left a simulated job in this browser.
    if (!job.engine) {
      await reconcileJob(job, () => failJob(job, "原型已升级，请重新确认本次素材。"));
      return;
    }
    let result;
    try {
      result = await jobRequest(path);
    } catch (error) {
      if (error.status !== 404 || job.accepted) throw error;
      result = await jobRequest(path, {method: "PUT", headers: {"Content-Type":"application/json"},
        body: JSON.stringify({engine:job.engine,type:job.type,person:job.person,garment:job.garment,style:job.style,custom:job.custom})});
    }
    await reconcileJob(job, async () => {
      if (result.state === "failed" || result.state === "archived") {
        await failJob(job, result.message || "结果已过期，请重试。");
      } else if (result.state === "ready") {
        if (await finishJob(job, result)) jobRequest(path, {method:"DELETE"}).catch(() => {});
      } else {
        if (!db.job.accepted) await commit(s => { s.job.accepted = true; });
        setJobMessage(result.state === "queued" ? "已提交，等待处理…" : "正在制作搭配图…");
      }
    });
  } catch (error) {
    if (error.status >= 400 && error.status < 500 && error.status !== 429) {
      await reconcileJob(job, () => failJob(job, error.message));
    } else if (db.job?.id === job.id) {
      setJobMessage("暂时连不上服务，恢复连接后会继续。");
    }
  } finally { checkingJob = false; }
}
function reconcileJob(job, change) {
  const apply = () => {
    db = load();
    if (db.job?.id === job.id) return change();
  };
  return navigator.locks ? navigator.locks.request(key + "-job", apply) : apply();
}
async function finishJob(j, result) {
  let toResult = screen === "wait",
    saved = await commit((s) => {
      let parts = [];
      for (let slot of ["person", "garment"]) {
        if (!j[slot]) continue;
        let source = s.items.find(
          (i) => i.type === "Uploads" && i.slot === slot && i.src === j[slot],
        );
        if (!source) {
          source = {
            id: crypto.randomUUID(),
            type: "Uploads",
            slot,
            src: j[slot],
            title: slot === "person" ? "人物照" : "衣物图",
            date: dayKey(new Date()),
          };
          s.items.unshift(source);
        }
        parts.push(source.id);
      }
      const style = styles[j.style];
      s.items.unshift({
        id: j.id,
        type: j.type,
        parts,
        src: result.image,
        engine: result.engine,
        title:
          j.type === "Try On"
            ? "虚拟试穿"
            : j.style === 7
              ? j.custom
              : style[0],
        date: dayKey(new Date()),
      });
      s.job = null;
    });
  if (!saved) {
    archiveBlocked = true;
    setJobMessage("图片已生成。请在衣橱腾出空间，再重试保存。");
    return false;
  }
  jobMessage = "";
  if (toResult) openItem(j.id, "result");
  else {
    render();
    notice("造型已保存到衣橱");
  }
  return true;
}
async function deleteItem(id) {
  if (cloud && account) {
    try {
      await cloud.remove(account.id,id,find(id)?.type === "Try On");
      go("Wardrobe");
      return notice("已从衣橱移除");
    } catch (error) { return notice(error.message); }
  }
  if (
    !await commit((s) => {
      s.items = s.items.filter((i) => i.id !== id);
      for (let k of Object.keys(s.plans))
        if (s.plans[k] === id) delete s.plans[k];
    })
  )
    return;
  go("Wardrobe");
  notice("已从衣橱移除");
}
async function act(action) {
  let [cmd, a, b] = action.split(":");
  switch (cmd) {
    case "retry-init":
      return location.reload();
    case "nav":
      return go(tabs[Number(a)]);
    case "close":
      return close();
    case "help":
      return modal(
        "衣橱使用指南",
        "<p>先上传人物照，或选一张示例照片。在「试穿」里选择想穿的衣物，在「穿搭生成」里选择喜欢的风格。</p><p>生成的造型会自动存入「衣橱」。打开造型后，点「加入日历」即可安排穿搭日期。</p>" +
          button("知道了", "close", "primary wide"),
      );
    case "sample":
      if (cloud && !account && tab === "Try On") return accountForm(false);
      draft()[a] = a === "person" ? photos[0] : photos[1];
      saveDraft();
      close();
      break;
    case "cloud-upload":
      if (!account) return accountForm(false);
      return chooseFile("wardrobe");
    case "select":
      if (cloud && !account && tab === "Try On") return accountForm(false);
      return selectPhoto(a);
    case "file":
      return chooseFile(a);
    case "pick":
      draft()[a] = find(b).src;
      saveDraft();
      close();
      break;
    case "next":
      draft().step = 2;
      saveDraft();
      if (editingChoice) return startJob();
      break;
    case "style": {
      const focused = document.activeElement;
      draft().style =
        (draft().style + Number(a) + styles.length) % styles.length;
      saveDraft();
      render();
      if (focused.matches(".style-card")) el("page").querySelector(".style-card").focus();
      else if (focused.dataset.action === action) el("page").querySelector('[data-action="' + action + '"]').focus();
      return;
    }
    case "check-service":
      close();
      return startJob();
    case "generate":
      return startJob();
    case "edit-choice":
      close();
      draft().step = a === "person" ? 1 : 2;
      editingChoice = true;
      saveDraft();
      render();
      if (a === "style") el("page").querySelector(".style-card").focus();
      else selectPhoto(a);
      return;
    case "submit":
      return (cloud ? submitCloudJob : queueJob)({
        ...draft(),
        engine: el("sheet").querySelector('[data-action="submit"]').dataset.engine,
        at: Date.now(),
        id: crypto.randomUUID(),
        type: tab,
      });
    case "retry-save":
      archiveBlocked = false;
      setJobMessage("正在保存到衣橱…");
      return settle();
    case "resume":
      tab = db.job.type;
      screen = "wait";
      break;
    case "back":
      editingChoice = false;
      if (screen === "detail") screen = "home";
      else if (screen === "result") {
        screen = "home";
        draft().step = draft().person ? 2 : 1;
      } else {
        draft().step = 1;
        saveDraft();
      }
      break;
    case "filter":
      filter = a;
      marked = "";
      render();
      el("page").querySelector('[aria-pressed="true"]').focus({preventScroll: true});
      return;
    case "item":
      return openItem(a);
    case "zoom":
      return modal(
        find(itemId).title,
        img(find(itemId).src, "完整造型", "zoom"),
      );
    case "menu":
      return menu(a);
    case "download": {
      let i = find(a),
        link = document.createElement("a");
      let temporaryUrl;
      if (cloud && i.src.startsWith("wardrobe:")) {
        try {
          const response = await fetch(cloud.imageUrl(i.src));
          if (!response.ok) throw Error();
          temporaryUrl = URL.createObjectURL(await response.blob());
        } catch { return notice("图片下载失败，请重新打开衣橱再试。"); }
      }
      link.href = temporaryUrl || i.src;
      link.download =
        "my-wardrobe-" + a + ((temporaryUrl || i.src.startsWith("data:")) ? ".jpg" : ".webp");
      link.click();
      if (temporaryUrl) setTimeout(()=>URL.revokeObjectURL(temporaryUrl),1000);
      close();
      return;
    }
    case "retry-tryon": {
      const previous = find(a);
      const sources = previous.parts.map(find).filter(Boolean);
      const person = sources.find(i => i.slot === "person");
      const garment = sources.find(i => i.slot === "garment");
      if (!person || !garment) return notice("原始素材已删除，请重新选择。");
      go("Try On");
      Object.assign(draft(), {person: person.src, garment: garment.src, step: 2});
      saveDraft();
      render();
      return startJob();
    }
    case "reuse": {
      let i = find(a);
      go("Try On");
      draft()[i.slot] = i.src;
      draft().step = i.slot === "garment" && draft().person ? 2 : 1;
      saveDraft();
      break;
    }
    case "ask-delete":
      return modal(
        "删除这张图片？",
        "<p>" +
          (find(a).type === "Uploads"
            ? "这张原图将被删除。用它生成的造型仍保存在衣橱里。"
            : "使用这套造型的日历安排也会一并移除。") +
          '</p><div class="bar">' +
          button("取消", "close") +
          button("删除", "delete:" + a, "danger") +
          "</div>",
      );
    case "delete":
      return deleteItem(a);
    case "reveal":
      filter = find(itemId).type;
      go("Wardrobe");
      marked = itemId;
      break;
    case "schedule":
      return modal(
        "加入日历",
        '<label for="plan-date">穿搭日期</label><input id="plan-date" class="text-input" type="date" value="' +
          dayKey(new Date()) +
          '"><div class="bar">' +
          button("添加穿搭", "date-plan:" + a, "primary") +
          "</div>",
      );
    case "date-plan":
      if (!el("plan-date").value) return notice("请选择日期");
      return plan(a, el("plan-date").value);
    case "save-plan":
      return savePlan(a, b);
    case "choose-plan": {
      let looks = db.items.filter((i) => i.type !== "Uploads");
      return modal(
        "选择一套穿搭",
        looks.length
          ? '<div class="mini-grid">' +
              looks
                .map((i) =>
                  button(
                    img(i.src, i.title) + "<small>" + esc(i.title) + "</small>",
                    "plan:" + i.id,
                    "",
                  ),
                )
                .join("") +
              "</div>"
          : "<p>生成造型后，就能在这里选择穿搭。</p>" +
              button("生成一套造型", "nav:2", "primary"),
      );
    }
    case "plan":
      return plan(a, stepDate);
    case "remove-plan":
      return modal(
        "移除当天的穿搭安排？",
        "<p>这套造型仍保存在衣橱里。</p>" +
          button("移除当天安排", "confirm-remove", "danger"),
      );
    case "confirm-remove":
      if (!await commit((s) => delete s.plans[stepDate])) return;
      close();
      break;
    case "toggle-month":
      mode = mode === "month" ? "week" : "month";
      break;
    case "today":
      stepDate = dayKey(new Date());
      break;
    case "day":
      stepDate = a;
      mode = "week";
      break;
    case "period": {
      let d = dateOf(stepDate);
      stepDate =
        mode === "week"
          ? shiftDay(stepDate, 7 * Number(a))
          : dayKey(new Date(d.getFullYear(), d.getMonth() + Number(a), 1, 12));
      break;
    }
    case "edit-profile":
      return editProfile();
    case "save-profile": {
      let name = el("nick").value.trim();
      if (!name) return notice("请输入昵称");
      if (await commit((s) => (s.name = name))) close();
      break;
    }
    case "refill":
      if (db.job) return notice("造型正在生成，请稍候。");
      if (!await commit((s) => (s.credit = 1))) return;
      close();
      notice("已恢复 1 次体验机会");
      break;
    case "signout":
      await saving;
      try {
        if (cloud) await cloud.signOut();
        else await jobRequest("/api/auth/logout",{method:"POST"});
        clearDrafts();
        sessionStorage.removeItem(pendingKey());
        changedIdentity();
      } catch (error) { notice(error.message); }
      return;
    case "signin":
    case "register":
      if (db.job) return notice("造型正在生成，完成后即可切换账号。");
      return accountForm(cmd === "register");
    case "guest":
      if (await commit(s => { s.signed = true; })) go("Try On");
      return;
    case "delete-account":
      return modal(
        "删除本地资料？",
        "<p>此浏览器中保存的照片、造型和日历安排都将删除。</p>" +
          button("删除资料及数据", "erase", "danger"),
      );
    case "erase":
      if (account || !await commit((s) => Object.assign(s, fresh(), { signed: false }))) return;
      clearDrafts();
      go("Profile");
      break;
    default:
      return;
  }
  render();
}
document.addEventListener("click", (e) => {
  let btn = e.target.closest("[data-action]");
  if (btn && !btn.disabled) act(btn.dataset.action);
});
el("sheet").addEventListener("click", (e) => {
  if (e.target === el("sheet")) {
    let r = el("sheet").getBoundingClientRect();
    if (
      e.clientX < r.left ||
      e.clientX > r.right ||
      e.clientY < r.top ||
      e.clientY > r.bottom
    )
      close();
  }
});
document.addEventListener("input", (e) => {
  if (e.target.id === "custom") {
    draft().custom = e.target.value;
    saveDraft();
    document.querySelector('[data-action="generate"]').disabled =
      !e.target.value.trim();
  }
});
let touchX;
document.addEventListener(
  "touchstart",
  (e) => {
    touchX = e.target.closest(".style-card") ? e.touches[0].clientX : null;
  },
  { passive: true },
);
document.addEventListener(
  "touchend",
  (e) => {
    if (touchX != null) {
      let dx = e.changedTouches[0].clientX - touchX;
      if (Math.abs(dx) > 35) act("style:" + (dx < 0 ? 1 : -1));
      touchX = null;
    }
  },
  { passive: true },
);
document.addEventListener("keydown", (e) => {
  if (
    e.target.closest(".style-card") &&
    ["ArrowLeft", "ArrowRight"].includes(e.key)
  ) {
    e.preventDefault();
    act("style:" + (e.key === "ArrowLeft" ? -1 : 1));
  }
});
window.addEventListener("storage", (e) => {
  if (e.key === "wardrobe-auth-change") { clearDrafts(); location.reload(); return; }
  if (!account && e.key === key) {
    const previousJob = db.job;
    db = load();
    if (previousJob?.id !== db.job?.id) { archiveBlocked = false; jobMessage = ""; }
    if (!db.signed) {
      clearDrafts();
      close();
    }
    if (screen === "wait" && !db.job) {
      let it = previousJob && find(previousJob.id);
      if (it) return openItem(it.id, "result");
      screen = "home";
    }
    render();
  }
});
async function cloudSnapshot() {
  const identity = await cloud.session();
  if (!identity) return {account:null};
  const [items,profile,state] = await Promise.all([cloud.garments(identity.id),cloud.profile(identity.id),cloud.tryOnState()]);
  const wardrobe = fresh();
  wardrobe.items = items;
  wardrobe.credit = state.credit;
  if (state.latest?.state === "running") wardrobe.job = {id:state.latest.id,type:"Try On"};
  if (profile) wardrobe.plans = profile.plans;
  if (profile) { wardrobe.name = profile.name; wardrobe.avatar = profile.avatar; }
  return {account:identity,wardrobe,revision:profile?.revision || 0};
}
async function initialize() {
  try {
    const current = cloud ? await cloudSnapshot() : await fetch("/api/auth/me",{cache:"no-store"}).then(r=>{ if (!r.ok) throw Error(); return r.json(); });
    if (current.account) {
      account = current.account;
      key = guestKey + "-" + account.id;
      db = current.wardrobe;
      revision = current.revision;
    }
  } catch {
    el("page").innerHTML = '<div class="empty"><h1>暂时连不上衣橱</h1><p>请检查连接后重试。</p>' + button("重试","retry-init","primary") + '</div>';
    return;
  }
  if (db.signed) restoreDrafts();
  else clearDrafts();
  if (location.hash === "#account" || sessionStorage.getItem("wardrobe-open-profile")) {
    tab = "Profile";
    sessionStorage.removeItem("wardrobe-open-profile");
  }
  if (cloud && (location.hash === "#wardrobe" || sessionStorage.getItem("open-cloud-wardrobe"))) {
    tab = "Wardrobe";
    sessionStorage.removeItem("open-cloud-wardrobe");
  }
  if (cloud && (location.hash === "#tryon" || sessionStorage.getItem("open-cloud-tryon"))) {
    tab = "Try On"; sessionStorage.removeItem("open-cloud-tryon");
  }
  if (db.job) { tab = db.job.type; screen = "wait"; }
  render();
  if (cloud) {
    if (account && sessionStorage.getItem(cloudPendingKey())) {
      const pending = sessionStorage.getItem(cloudPendingKey());
      const ticket = pending.startsWith("{") ? JSON.parse(pending) : {id:pending};
      db.job = {...ticket,type:"Try On",...drafts["Try On"]};
      tab = "Try On"; screen = "wait"; render();
    }
    if (db.job) jobMessage = "正在制作上身图，完成后会自动存入衣橱。";
    setInterval(()=>{ if (!document.hidden && db.job) pollCloudJob(); },3000);
    if (db.job) pollCloudJob();
    if (!account && ["#register","#login"].includes(location.hash)) accountForm(location.hash === "#register");
    document.addEventListener("visibilitychange",()=>{ if (!document.hidden) refreshGarments(); });
    setInterval(()=>{ if (!document.hidden) refreshGarments(); },1800000);
    return;
  }
  const interrupted = sessionStorage.getItem(pendingKey());
  if (interrupted) queueJob(JSON.parse(interrupted));
  settle();
  setInterval(settle,850);
}
function changedIdentity() {
  if (cloud) history.replaceState(null,"",location.pathname);
  sessionStorage.setItem("wardrobe-open-profile","1");
  localStorage.setItem("wardrobe-auth-change",crypto.randomUUID());
  location.reload();
}
function accountForm(register) {
  const hasGuestData = db.items.length || db.avatar || db.name !== fresh().name || Object.keys(db.plans).length;
  modal(register ? "注册账号" : "登录我的衣橱",
    '<form id="account-form" class="account-form"><label>邮箱<input required name="email" type="email" class="text-input" autocomplete="username" maxlength="254"></label>' +
    '<label>密码<input required name="password" type="password" class="text-input" maxlength="128" autocomplete="' +
    (register ? 'new-password" minlength="8" placeholder="至少 8 个字符"' : 'current-password"') + '></label>' +
    (register && !cloud && hasGuestData ? '<label class="import-option"><input type="checkbox" name="transfer">将此浏览器的访客衣橱移入新账号（含照片、造型和日历）</label>' : '') +
    '<p role="alert" class="auth-error"></p><button class="primary wide" type="submit">' +
    (register ? "注册并登录" : "登录") + '</button></form>' +
    button(register ? "已有账号，去登录" : "还没有账号？去注册", register ? "signin" : "register","minor"));
  el("account-form").onsubmit = async event => {
    event.preventDefault();
    const form = event.currentTarget, submit = form.querySelector('[type="submit"]');
    if (submit.disabled) return;
    submit.disabled = true;
    const transfer = !!form.elements.transfer?.checked;
    const source = localStorage.getItem(guestKey);
    const data = {email:form.elements.email.value,password:form.elements.password.value};
    if (transfer) data.wardrobe = load();
    try {
      if (cloud) {
        await cloud.authenticate(register,data);
        if (tab === "Try On" && !["#register","#login"].includes(location.hash)) sessionStorage.setItem("open-cloud-tryon","1");
        else sessionStorage.setItem("open-cloud-wardrobe","1");
      } else await jobRequest("/api/auth/"+(register ? "register" : "login"),{
        method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)
      });
      if (transfer && localStorage.getItem(guestKey) === source) {
        localStorage.removeItem(guestKey);
        clearDrafts();
        sessionStorage.removeItem(pendingKey());
      }
      changedIdentity();
    } catch (error) {
      form.querySelector('[role="alert"]').textContent = error.message;
      submit.disabled = false;
    }
  };
}
initialize();
