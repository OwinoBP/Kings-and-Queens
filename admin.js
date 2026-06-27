// Replace these with the Airtable URLs you want the client to use.
const AIRTABLE_EDITOR_URL = "https://airtable.com/appwFq9FXqtf2cV6B/tbl7SBcj3I3jc0QbU";
const AIRTABLE_ADD_FORM_URL = "https://airtable.com/appwFq9FXqtf2cV6B/pagWEy5JYFErSCwn4/form";
const AIRTABLE_BASE_URL = "https://airtable.com/appwFq9FXqtf2cV6B";

const editorLink = document.getElementById("airtable-editor-link");
const addLink = document.getElementById("airtable-add-link");
const baseLink = document.getElementById("airtable-base-link");
const adminNote = document.getElementById("admin-note");

function applyAdminLink(element, url) {
  if (!element) {
    return;
  }

  if (!url || url.includes("YOUR_")) {
    element.setAttribute("aria-disabled", "true");
    element.removeAttribute("target");
    element.removeAttribute("rel");
    element.href = "#";
    return;
  }

  element.href = url;
}

applyAdminLink(editorLink, AIRTABLE_EDITOR_URL);
applyAdminLink(addLink, AIRTABLE_ADD_FORM_URL);
applyAdminLink(baseLink, AIRTABLE_BASE_URL);

if (
  !AIRTABLE_EDITOR_URL.includes("YOUR_") &&
  !AIRTABLE_ADD_FORM_URL.includes("YOUR_") &&
  !AIRTABLE_BASE_URL.includes("YOUR_")
) {
  adminNote.textContent = "This admin page is ready to share. Use it as the single bookmark for your client.";
}

// Pending submissions UI
const retryBtn = document.getElementById('retry-pending-btn');
const pendingCountEl = document.getElementById('pending-count');

function pendingKey() { return 'pendingSubmissions'; }

function updatePendingCount() {
  try {
    const list = JSON.parse(localStorage.getItem(pendingKey()) || '[]');
    pendingCountEl.textContent = `${list.length} pending`;
  } catch (e) {
    pendingCountEl.textContent = '0 pending';
  }
}

async function retryPending() {
  try {
    const list = JSON.parse(localStorage.getItem(pendingKey()) || '[]');
    if (!list.length) return alert('No pending submissions');

    const remaining = [];
    for (const item of list) {
      try {
        const res = await fetch(getWorkerUrl(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item.payload)
        });
        if (!res.ok) throw new Error('Retry failed');
      } catch (err) {
        remaining.push(item);
      }
    }

    localStorage.setItem(pendingKey(), JSON.stringify(remaining));
    updatePendingCount();
    alert(`Retry complete. ${remaining.length} still pending.`);
  } catch (e) {
    console.error(e);
    alert('Retry failed — check the console.');
  }
}

if (retryBtn) {
  retryBtn.addEventListener('click', retryPending);
}

updatePendingCount();
