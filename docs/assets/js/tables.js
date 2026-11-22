// yash.nvim — sortable, filterable course tables.
// Click a column heading to sort (click again to flip); filter by subject or status.

function sortTable(table, key, dir) {
  const body = table.tBodies[0];
  const rows = [...body.rows];
  const num = key === 'term' || key === 'status';
  rows.sort((a, b) => {
    const x = a.dataset[key], y = b.dataset[key];
    const c = num ? Number(x) - Number(y) : x.localeCompare(y);
    return (dir === 'ascending' ? c : -c) || a.dataset.code.localeCompare(b.dataset.code);
  });
  let prev = null;
  rows.forEach((r) => { body.appendChild(r); r.classList.toggle('is-term-start', key === 'term' && r.dataset.term !== prev); prev = r.dataset.term; });
  table.querySelectorAll('th').forEach((th) => th.removeAttribute('aria-sort'));
  table.querySelector(`[data-sort="${key}"]`).closest('th').setAttribute('aria-sort', dir);
}

document.querySelectorAll('table[data-sortable]').forEach((table) => {
  table.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-sort]'); if (!b) return;
    const th = b.closest('th');
    const cur = th.getAttribute('aria-sort');
    const dir = cur ? (cur === 'ascending' ? 'descending' : 'ascending') : (b.dataset.sort === 'term' ? 'descending' : 'ascending');
    sortTable(table, b.dataset.sort, dir);
  });
  const tools = table.closest('.ctable-wrap')?.previousElementSibling;
  if (!tools || !tools.matches('[data-course-tools]')) return;
  const count = tools.querySelector('[data-course-count]');
  tools.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-cfilter]'); if (!b) return;
    tools.querySelectorAll('button[data-cfilter]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    const f = b.dataset.cfilter;
    let shown = 0;
    [...table.tBodies[0].rows].forEach((r) => {
      const ok = f === 'all' || (f.startsWith('state:') ? r.dataset.state === f.slice(6) : r.dataset.subject === f);
      r.hidden = !ok; if (ok) shown++;
    });
    count.textContent = `${shown} course${shown === 1 ? '' : 's'}`;
  });
});
