// Compare the previous snapshot's items against the current ones.
// `added`   — items whose id wasn't seen before (the headline of each issue)
// `changed` — same id, but the title was edited since last run
// `removed` — items that disappeared (kept for completeness; not published)
export function diffItems(previous, current) {
  const prevById = new Map(previous.map((i) => [i.id, i]));
  const currById = new Map(current.map((i) => [i.id, i]));

  const added = current.filter((i) => !prevById.has(i.id));
  const removed = previous.filter((i) => !currById.has(i.id));
  const changed = current.filter((i) => {
    const prev = prevById.get(i.id);
    return prev && prev.title !== i.title;
  });

  return { added, changed, removed };
}
