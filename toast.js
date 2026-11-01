/* ════════════════════════════════════════════════════════
   toast.js — Premium toast notifications
   ════════════════════════════════════════════════════════ */

const container = document.getElementById("toast-container");

export function toast(message, type = "info", duration = 3500) {
  const el = document.createElement("div");
  el.className = `toast toast--${type}`;
  el.setAttribute("role", "status");
  el.innerHTML = `<span class="toast-dot"></span><span>${message}</span>`;
  container.appendChild(el);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => el.classList.add("toast--visible"));
  });

  const remove = () => {
    el.classList.remove("toast--visible");
    el.addEventListener("transitionend", () => el.remove(), { once: true });
  };
  setTimeout(remove, duration);
  return remove;
}

export const toastSuccess = (m) => toast(m, "success");
export const toastError   = (m) => toast(m, "error", 4500);
export const toastWarn    = (m) => toast(m, "warning");
export const toastInfo    = (m) => toast(m, "info");
