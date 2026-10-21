(() => {
  const app = document.getElementById("app");
  const toastEl = document.getElementById("toast");
  let info, posts;

  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  const toast = (msg) => {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    setTimeout(() => toastEl.classList.remove("show"), 1800);
  };
  const dayKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const fmt = (iso) => {
    const d = new Date(iso);
    return "Date: " + d.toLocaleDateString("en-US") + " " +
      d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).toLowerCase();
  };

  // Raw HTML support: posts with "format": "html" render their body as HTML (scripts/handlers removed)
  const sanitize = (html) => {
    const doc = new DOMParser().parseFromString(html, "text/html");
    doc.querySelectorAll("script,style,iframe,object,embed,link,meta,base,form").forEach(n => n.remove());
    doc.body.querySelectorAll("*").forEach(n => {
      [...n.attributes].forEach(a => {
        const v = a.value.trim().toLowerCase();
        if (a.name.startsWith("on") || (/^(href|src|xlink:href)$/.test(a.name) && /^(javascript|data):/.test(v) && !/^data:image\//.test(v))) n.removeAttribute(a.name);
      });
      if (n.tagName === "A") { n.target = "_blank"; n.rel = "noopener"; }
    });
    return doc.body.innerHTML;
  };
  const plainOf = (p) => p.format === "html" ? new DOMParser().parseFromString(p.body, "text/html").body.textContent.trim() : p.body;
  const SHARE_SVG = '<svg viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>';
  const PIN_SVG = '<svg viewBox="0 0 24 24"><path d="M12 17v5M9 3h6l-1 6 3 3v2H7v-2l3-3-1-6z"/></svg>';
  const BACK_SVG = '<svg viewBox="0 0 24 24"><path d="M20 12H4M10 6l-6 6 6 6"/></svg>';
  const pad = (n) => String(n).padStart(2, "0");
  const dateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const getNow = () => {
    const r = info.referenceDate;
    if (!r) return new Date();
    return new Date(r.length === 10 ? r + "T12:00:00" : r);
  };
  const dayDiff = (iso) => Math.round((startOfDay(getNow()) - startOfDay(new Date(iso))) / 864e5);
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"} ago`;
  const rel = (iso) => {
    const dd = dayDiff(iso);
    if (dd <= 1) {
      const m = Math.round((getNow() - new Date(iso)) / 60000);
      if (m < 1) return "Just now";
      if (m < 60) return plural(m, "minute");
      return plural(Math.floor(m / 60), "hour");
    }
    return plural(dd, "day");
  };
  const fmtHeading = (iso) => new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });

  async function load() {
    const first = el("div", "msg");
    const sp = el("div", "spinner");
    sp.setAttribute("role", "progressbar");
    first.append(sp);
    app.replaceChildren(first);
    try {
      info = await (await fetch("information.json")).json();
      posts = await (await fetch(info.postsFile || "posts.json")).json();
      posts.sort((a, b) => new Date(b.date) - new Date(a.date));
      document.title = info.siteTitle;
      document.getElementById("footer").textContent = info.footer || "";
      topBtn.setAttribute("aria-label", info.labels.goTop || "Go to top");
      route();
    } catch (e) {
      app.replaceChildren(el("p", "msg", "Could not load data. Run this site from a local server (for example: python3 -m http.server) instead of opening the file directly."));
    }
  }

  function route() {
    const id = new URLSearchParams(location.search).get("postid");
    if (id) return showPost(id);
    const day = new URLSearchParams(location.search).get("date");
    if (day) return showDay(day);
    if (location.hash === "#dashboard") return showDashboard();
    showProfile();
  }

  const heroSvg = () => {
    const tree = (x, h, c) => {
      const w = h * 0.55; let o = "";
      for (let i = 0; i < 3; i++) {
        const top = 200 - h + i * h * 0.26, bot = top + h * 0.46, hw = w * (0.35 + i * 0.25);
        o += `<polygon points="${x},${top} ${x - hw},${bot} ${x + hw},${bot}" fill="${c}"/>`;
      }
      return o + `<rect x="${x - 3}" y="${200 - h * 0.12}" width="6" height="${h * 0.12}" fill="${c}"/>`;
    };
    let back = "", front = "";
    for (let i = 0; i < 14; i++) back += tree(i * 31 - 6 + (i % 3) * 5, 78 + (i * 17) % 34, "#4a936a");
    for (let i = 0; i < 9; i++) front += tree(i * 52 + 14 + (i % 2) * 9, 104 + (i * 23) % 40, "#133d28");
    return `<svg viewBox="0 0 400 200" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <circle cx="318" cy="64" r="64" fill="#fff6c9" opacity=".16"/><circle cx="318" cy="64" r="34" fill="#fff6c9" opacity=".9"/>
      ${back}${front}<rect y="192" width="400" height="8" fill="#0d3220"/></svg>`;
  };
  const ICONS = {
    mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3.5 7.5l8.5 6 8.5-6"/></svg>',
    github: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.38 7.86 10.9.58.1.79-.25.79-.56v-2c-3.2.7-3.87-1.37-3.87-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.03 1.76 2.69 1.25 3.35.96.1-.74.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.18-3.09-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.78 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.18 1.83 1.18 3.09 0 4.42-2.7 5.4-5.27 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z"/></svg>',
    facebook: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.8-4.7 4.54-4.7 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.26h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07Z"/></svg>',
    instagram: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117Z"/></svg>',
    link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>',
    chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>'
  };

  function tile(icon, label, value, href, external) {
    const a = el("a", "tile ripple");
    a.href = href;
    if (external) { a.target = "_blank"; a.rel = "noopener"; }
    const ic = el("span", "tile-ic"); ic.innerHTML = icon;
    const tx = el("span", "tile-tx");
    tx.append(el("small", null, label), el("span", null, value));
    const ch = el("span", "tile-go"); ch.innerHTML = ICONS.chevron;
    a.append(ic, tx, ch);
    return a;
  }

  function showProfile() {
    const p = info.profile;
    app.replaceChildren();
    app.className = "narrow home";
    const hero = el("div", "hero");
    hero.innerHTML = heroSvg();
    const card = el("section", "profile-card");
    const av = el("div", "avatar");
    if (p.avatar) { const img = el("img"); img.src = p.avatar; img.alt = p.name; av.append(img); }
    else av.textContent = p.name.split(" ").map(w => w[0]).slice(0, 2).join("");
    card.append(av, el("h1", null, p.name));
    if (p.bio) card.append(el("p", "bio", p.bio));
    if (posts.length) {
      const stats = el("div", "stats");
      stats.append(el("span", "chip", `${posts.length} ${info.labels.statPosts}`),
                   el("span", "chip", `${info.labels.statLast} ${rel(posts[0].date)}`));
      card.append(stats);
    }
    const list = el("div", "tiles");
    list.append(tile(ICONS.mail, info.labels.email, p.email, "mailto:" + p.email, false));
    list.append(tile(ICONS.github, info.labels.github, p.github, /^https?:/.test(p.github) ? p.github : "https://" + p.github, true));
    const socials = el("div", "socials");
    (p.socials || []).forEach(sc => {
      const a = el("a", "social ripple");
      a.href = sc.url; a.target = "_blank"; a.rel = "noopener";
      a.innerHTML = ICONS[sc.type] || ICONS.link;
      const name = sc.label || sc.type;
      a.setAttribute("aria-label", name); a.title = name;
      socials.append(a);
    });
    if (socials.childElementCount) list.append(socials);
    const btn = el("button", "btn ripple", info.labels.dashboardButton);
    btn.onclick = () => { location.hash = "dashboard"; };
    card.append(list, btn);
    app.append(hero, card);
  }

  function makeCard(post, full) {
    const t = info.types[post.type] || { color: "#4f7a4a", label: "" };
    const card = el("article", "card ripple");
    card.id = "post-" + post.id;
    card.style.setProperty("--c", t.color);
    if (t.bg) card.style.setProperty("--bg", t.bg);
    const body = el("div", "card-body");
    const meta = el("div", "meta");
    const share = el("button", "share icon-btn ripple");
    share.innerHTML = '<svg viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>';
    share.setAttribute("aria-label", info.labels.share);
    share.onclick = () => sharePost(post.id);
    const dot = el("span", "dot");
    dot.title = t.label;
    dot.setAttribute("role", "img");
    dot.setAttribute("aria-label", t.label);
    const time = el("time", null, fmt(post.date));
    time.append(el("span", "rel", rel(post.date)));
    meta.append(dot, time);
    if (post.pinned) {
      const pf = el("span", "pin-flag");
      pf.innerHTML = PIN_SVG;
      pf.title = info.labels.pinned;
      meta.append(pf);
    }
    meta.append(share);
    body.append(meta);
    if (post.title) body.append(el("h2", null, post.title));
    const rich = post.format === "html";
    const text = el(rich ? "div" : "p", "text" + (rich ? " rich" : ""));
    if (rich) text.innerHTML = sanitize(post.body); else text.textContent = post.body;
    body.append(text);
    if (full) card.classList.add("open");
    else if (plainOf(post).length > (rich ? 90 : 110) || (rich && /<(img|ul|ol|blockquote|table)/i.test(post.body))) {
      const more = el("button", "more ripple", info.labels.seeMore);
      more.onclick = () => {
        const open = card.classList.toggle("open");
        more.textContent = open ? info.labels.seeLess : info.labels.seeMore;
      };
      body.append(more);
    }
    if (post.tags && post.tags.length) {
      const tags = el("div", "tags");
      post.tags.forEach(x => tags.append(el("span", null, "#" + x)));
      body.append(tags);
    }
    card.append(body);
    return card;
  }

  const sharePost = (id) => copyLink("postid", id);
  const shareDay = (ds) => copyLink("date", ds);
  async function copyLink(param, value) {
    const url = `${location.origin}${location.pathname}?${param}=${encodeURIComponent(value)}`;
    try { await navigator.clipboard.writeText(url); toast(info.labels.copied); }
    catch { prompt("Copy this link:", url); }
  }

  function showDashboard() {
    app.replaceChildren();
    app.className = "wide";
    const bar = el("header", "bar");
    const back = el("button", "back icon-btn ripple");
    back.setAttribute("aria-label", "Back");
    back.innerHTML = '<svg viewBox="0 0 24 24"><path d="M20 12H4M10 6l-6 6 6 6"/></svg>';
    back.onclick = () => { location.hash = ""; };
    bar.append(back, el("h1", null, info.labels.dashboardTitle));

    const feed = el("div", "feed");
    const sections = {};
    const footer = el("div", "more-wrap");
    const moreBtn = el("button", "btn-tonal ripple");
    const spinner = el("div", "spinner");
    spinner.setAttribute("role", "progressbar");
    spinner.setAttribute("aria-label", info.labels.loading);
    spinner.hidden = true;
    footer.append(moreBtn, spinner);

    // Sections are keyed by day: Today, Yesterday, then one section per older date
    const getSection = (dd, iso) => {
      const key = dd <= 0 ? "today" : dd === 1 ? "yesterday" : "d" + dd;
      if (sections[key]) return sections[key];
      const sec = el("section", "section");
      sec.id = key;
      const head = el("div", "sec-head");
      head.append(el("h2", "pill", key === "today" ? info.labels.today : key === "yesterday" ? info.labels.yesterday : fmtHeading(iso)));
      if (dd > 1) head.append(el("span", "sub", plural(dd, "day")));
      const day = new Date(startOfDay(getNow()));
      day.setDate(day.getDate() - Math.max(dd, 0));
      const ds = dateKey(day);
      const sb = el("button", "share-day icon-btn ripple");
      sb.innerHTML = SHARE_SVG;
      sb.setAttribute("aria-label", info.labels.shareDay);
      sb.title = info.labels.shareDay;
      sb.onclick = () => shareDay(ds);
      head.append(sb);
      const grid = el("div", "grid");
      sec.append(head, grid, el("p", "empty", info.labels.emptySection));
      feed.insertBefore(sec, footer);
      return (sections[key] = { grid });
    };

    feed.append(footer);
    getSection(0); getSection(1); // always present so "Today" can be scrolled to

    // Paged rendering: newest first, a few at a time, so big lists never freeze the page
    const pageSize = info.pageSize || 10;
    let shown = 0;
    const updateBtn = () => {
      const left = posts.length - shown;
      footer.hidden = left <= 0;
      moreBtn.textContent = `${info.labels.loadMore} (${Math.min(pageSize, left)} of ${left})`;
    };
    const renderPage = () => {
      const end = Math.min(shown + pageSize, posts.length);
      for (; shown < end; shown++) {
        const p = posts[shown];
        getSection(dayDiff(p.date), p.date).grid.append(makeCard(p));
      }
    };
    moreBtn.onclick = () => {
      moreBtn.hidden = true;
      spinner.hidden = false;
      setTimeout(() => requestAnimationFrame(() => {
        renderPage();
        spinner.hidden = true;
        moreBtn.hidden = false;
        updateBtn();
      }), 450);
    };
    renderPage();
    updateBtn();

    // Pinned posts: sticky under the app bar, today's pins first, user can dismiss them
    const store = {
      get() { try { return new Set(JSON.parse(localStorage.getItem("dismissedPins") || "[]")); } catch { return new Set(); } },
      set(v) { try { localStorage.setItem("dismissedPins", JSON.stringify([...v])); } catch {} }
    };
    const dismissed = store.get();
    const pinnedAll = posts.filter(p => p.pinned);
    const pinned = [...pinnedAll.filter(p => dayDiff(p.date) <= 0), ...pinnedAll.filter(p => dayDiff(p.date) > 0)];
    const pinbar = el("aside", "pinbar");
    pinbar.setAttribute("aria-label", info.labels.pinned);
    const restore = el("button", "icon-btn ripple restore");
    restore.innerHTML = PIN_SVG;
    restore.setAttribute("aria-label", info.labels.showPinned);
    restore.title = info.labels.showPinned;
    bar.append(restore);
    let pinIdx = 0, expanded = false;
    const iconBtn = (svg, label, fn) => {
      const b = el("button", "icon-btn ripple small");
      b.innerHTML = svg; b.setAttribute("aria-label", label); b.title = label; b.onclick = fn;
      return b;
    };
    const renderPins = () => {
      const list = pinned.filter(p => !dismissed.has(String(p.id)));
      restore.hidden = !pinned.some(p => dismissed.has(String(p.id)));
      pinbar.hidden = !list.length;
      app.classList.toggle("has-pins", list.length > 0);
      pinbar.replaceChildren();
      if (!list.length) return;
      pinIdx = Math.min(pinIdx, list.length - 1);
      const p = list[pinIdx];
      const t = info.types[p.type] || { color: "#4f7a4a" };
      const card = el("div", "pin-card" + (expanded ? " open" : ""));
      card.style.setProperty("--c", t.color);
      if (t.bg) card.style.setProperty("--bg", t.bg);
      const ic = el("span", "pin-ic"); ic.innerHTML = PIN_SVG;
      const tx = el("button", "pin-tx ripple");
      const head = el("span", "pin-head");
      head.append(el("b", null, p.title || ""), el("span", "rel", rel(p.date)));
      const pb = el("span", "pin-body");
      if (expanded && p.format === "html") pb.innerHTML = sanitize(p.body); else pb.textContent = plainOf(p);
      tx.append(head, pb);
      if (plainOf(p).length > 80 || (expanded && p.format === "html")) tx.append(el("span", "pin-more", expanded ? info.labels.seeLess : info.labels.seeMore));
      tx.onclick = () => { expanded = !expanded; renderPins(); };
      const act = el("div", "pin-act");
      if (list.length > 1) {
        act.append(
          iconBtn('<svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg>', info.labels.prevPin, () => { pinIdx = (pinIdx - 1 + list.length) % list.length; expanded = false; renderPins(); }),
          el("span", "pin-count", `${pinIdx + 1}/${list.length}`),
          iconBtn(ICONS.chevron, info.labels.nextPin, () => { pinIdx = (pinIdx + 1) % list.length; expanded = false; renderPins(); })
        );
      }
      act.append(iconBtn('<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>', info.labels.unpin, () => {
        dismissed.add(String(p.id)); store.set(dismissed); expanded = false; renderPins();
      }));
      card.append(ic, tx, act);
      pinbar.append(card);
    };
    restore.onclick = () => { pinned.forEach(p => dismissed.delete(String(p.id))); store.set(dismissed); pinIdx = 0; renderPins(); };
    renderPins();

    app.append(bar, pinbar, feed);
    document.getElementById("today").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function showDay(ds) {
    app.replaceChildren();
    app.className = "wide";
    const bar = el("header", "bar");
    const back = el("button", "back icon-btn ripple");
    back.setAttribute("aria-label", "Back to dashboard");
    back.innerHTML = BACK_SVG;
    back.onclick = () => { location.href = location.pathname + "#dashboard"; };
    const valid = /^\d{4}-\d{2}-\d{2}$/.test(ds);
    const list = valid ? posts.filter(p => p.date.slice(0, 10) === ds) : [];
    bar.append(back, el("h1", null, valid ? fmtHeading(ds + "T12:00:00") : info.siteTitle));
    if (valid) {
      const sb = el("button", "share-day icon-btn ripple");
      sb.innerHTML = SHARE_SVG;
      sb.setAttribute("aria-label", info.labels.shareDay);
      sb.style.marginLeft = "auto";
      sb.onclick = () => shareDay(ds);
      bar.append(sb);
    }
    const feed = el("div", "feed");
    if (!list.length) feed.append(el("p", "msg", info.labels.noPostsDay));
    else {
      const grid = el("div", "grid");
      feed.append(grid);
      const pageSize = info.pageSize || 10;
      let shown = 0;
      const footer = el("div", "more-wrap");
      const moreBtn = el("button", "btn-tonal ripple");
      const spinner = el("div", "spinner");
      spinner.setAttribute("role", "progressbar");
      spinner.hidden = true;
      footer.append(moreBtn, spinner);
      const update = () => {
        const left = list.length - shown;
        footer.hidden = left <= 0;
        moreBtn.textContent = `${info.labels.loadMore} (${Math.min(pageSize, left)} of ${left})`;
      };
      const render = () => {
        const end = Math.min(shown + pageSize, list.length);
        for (; shown < end; shown++) grid.append(makeCard(list[shown]));
      };
      moreBtn.onclick = () => {
        moreBtn.hidden = true; spinner.hidden = false;
        setTimeout(() => requestAnimationFrame(() => { render(); spinner.hidden = true; moreBtn.hidden = false; update(); }), 450);
      };
      render(); update();
      feed.append(footer);
    }
    app.append(bar, feed);
    window.scrollTo(0, 0);
  }

  function showPost(id) {
    app.replaceChildren();
    app.className = "narrow";
    const bar = el("header", "bar");
    const back = el("button", "back icon-btn ripple");
    back.setAttribute("aria-label", "Back to dashboard");
    back.innerHTML = '<svg viewBox="0 0 24 24"><path d="M20 12H4M10 6l-6 6 6 6"/></svg>';
    back.onclick = () => { location.href = location.pathname + "#dashboard"; };
    bar.append(back, el("h1", null, info.siteTitle));
    const post = posts.find(p => String(p.id) === String(id));
    const wrap = el("div", "single");
    wrap.append(post ? makeCard(post, true) : el("p", "msg", info.labels.notFound));
    app.append(bar, wrap);
  }

  // Material ripple
  document.addEventListener("pointerdown", (e) => {
    const t = e.target.closest(".ripple");
    if (!t) return;
    const r = t.getBoundingClientRect();
    const size = Math.max(r.width, r.height) * 2;
    const w = el("span", "wave");
    w.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`;
    t.append(w);
    w.addEventListener("animationend", () => w.remove());
  });
  const topBtn = document.getElementById("top");
  topBtn.onclick = () => window.scrollTo({ top: 0, behavior: "smooth" });
  window.addEventListener("scroll", () => {
    document.body.classList.toggle("scrolled", scrollY > 4);
    topBtn.classList.toggle("show", scrollY > 400);
  }, { passive: true });

  window.addEventListener("hashchange", () => {
    const q = new URLSearchParams(location.search);
    if (q.get("postid") || q.get("date")) return;
    route();
  });
  load();
})();
