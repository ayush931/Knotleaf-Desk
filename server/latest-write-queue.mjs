/** One running write and one replaceable latest snapshot per room. */
export function enqueueLatest(writes, waiting, key, value, write) {
  waiting.set(key, value);
  if (writes.has(key)) return writes.get(key);
  const task = Promise.resolve().then(async () => {
    let failure;
    while (waiting.has(key)) {
      const next = waiting.get(key);
      waiting.delete(key);
      try {
        await write(next);
        failure = undefined;
      } catch (error) {
        failure = error;
      }
    }
    if (failure) throw failure;
  });
  writes.set(key, task);
  task
    .finally(() => {
      if (writes.get(key) === task) writes.delete(key);
    })
    .catch(() => {});
  return task;
}
