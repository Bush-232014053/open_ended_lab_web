// common js for all pages (CSE 3120)

function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function apiCall(url, method, body) {
  const options = {
    method: method || "GET",
    credentials: "include",
    headers: {}
  };

  if (body && !(body instanceof FormData)) {
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(body);
  } else if (body instanceof FormData) {
    options.body = body;
  }

  const res = await fetch(url, options);
  const data = await res.json().catch(function () {
    return {};
  });

  if (!res.ok) {
    throw new Error(data.error || "Something went wrong");
  }
  return data;
}

function getQuery(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function formatDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleDateString();
}

function categoryName(cat) {
  if (cat === "lab-kits") return "Lab Kits";
  if (!cat) return "";
  return cat.charAt(0).toUpperCase() + cat.slice(1);
}

function statusBadge(status) {
  const safe = escapeHtml(status || "unknown");
  return (
    '<span class="badge badge-status badge-' +
    safe +
    '">Status: ' +
    safe +
    "</span>"
  );
}

function itemImage(item) {
  if (item && item.image_url) return item.image_url;
  return "/images/no-photo.svg";
}

function imgTag(item, extraClass) {
  const src = itemImage(item);
  const alt = escapeHtml(item && item.title ? item.title : "Item photo");
  return (
    '<img src="' +
    escapeHtml(src) +
    '" class="' +
    (extraClass || "card-img-top item-img") +
    '" alt="' +
    alt +
    '" onerror="this.onerror=null;this.src=\'/images/no-photo.svg\'">'
  );
}

function showAlert(id, msg, type) {
  const el = document.getElementById(id);
  if (!el) return;
  el.className = "alert alert-" + (type || "danger");
  el.style.display = "block";
  el.setAttribute("role", "alert");
  el.innerText = msg;
}

async function getUser() {
  const data = await apiCall("/api/auth/me", "GET");
  return data.user;
}

async function requireLogin() {
  const user = await getUser();
  if (!user) {
    window.location.href = "login.html";
    return null;
  }
  return user;
}

async function logoutUser() {
  await apiCall("/api/auth/logout", "POST", {});
  window.location.href = "index.html";
}

function navLink(href, text, page) {
  const isActive = page === text.toLowerCase();
  const current = isActive ? ' aria-current="page"' : "";
  const active = isActive ? " active" : "";
  return (
    '<li class="nav-item"><a class="nav-link' +
    active +
    '" href="' +
    href +
    '"' +
    current +
    ">" +
    text +
    "</a></li>"
  );
}

async function loadNavbar(page) {
  const user = await getUser();
  const box = document.getElementById("navbarArea");
  if (!box) return user;

  let extra = "";
  let right = "";

  if (user) {
    extra =
      navLink("add-item.html", "Add Item", page) +
      navLink("dashboard.html", "Dashboard", page);
    right =
      '<span class="navbar-text text-white me-3">' +
      escapeHtml(user.full_name) +
      '</span><button type="button" class="btn btn-sm btn-outline-light" id="logoutBtn">Logout</button>';
  } else {
    right =
      '<a class="btn btn-sm btn-light me-2" href="login.html">Login</a>' +
      '<a class="btn btn-sm btn-primary" href="register.html">Register</a>';
  }

  box.innerHTML =
    '<a class="skip-link" href="#mainContent">Skip to main content</a>' +
    '<nav class="navbar navbar-expand-lg navbar-dark navbar-custom" aria-label="Main">' +
    '<div class="container">' +
    '<a class="navbar-brand" href="index.html">ULAB Campus Library</a>' +
    '<button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#mainNav" aria-controls="mainNav" aria-expanded="false" aria-label="Open menu">' +
    '<span class="navbar-toggler-icon"></span></button>' +
    '<div class="collapse navbar-collapse" id="mainNav">' +
    '<ul class="navbar-nav me-auto mb-2 mb-lg-0">' +
    navLink("index.html", "Home", page) +
    navLink("browse.html", "Browse", page) +
    extra +
    "</ul>" +
    '<div class="d-flex align-items-center">' +
    right +
    "</div></div></div></nav>";

  const btn = document.getElementById("logoutBtn");
  if (btn) {
    btn.onclick = logoutUser;
  }
  return user;
}

function loadFooter() {
  const box = document.getElementById("footerArea");
  if (!box) return;
  box.innerHTML =
    '<footer class="footer-bar text-center">' +
    "<p class='mb-0'>CSE 3120 Open Ended Lab (Section 02) | P2P Campus Tool &amp; Equipment Library | ULAB Summer 2026</p>" +
    "</footer>";
}
