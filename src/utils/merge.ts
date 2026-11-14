// Слияние локальных правок с актуальным состоянием общей базы.
//
// Зачем: если отправлять наверх весь каталог из вкладки, то вкладка со
// старыми данными возвращает удалённый проект. Поэтому считается разница
// «было → стало» и накладывается на свежие данные, а удаления дополнительно
// защищены списком «могил».
import type { StudioData } from "../types";

/**
 * Применяет локальные правки к АКТУАЛЬНОЙ копии из общей базы.
 *
 * Почему так: раньше наверх уходил весь каталог из этой вкладки, поэтому
 * вкладка со старыми данными возвращала удалённый проект. Теперь считается
 * разница «было → стало», и она накладывается на свежие данные.
 *
 * base — что мы видели в базе до правки, local — что сейчас на экране,
 * remote — что реально лежит в базе, tombs — что удалено на этом устройстве.
 */
export function mergeIntoRemote(
  base: StudioData | null,
  local: StudioData,
  remote: StudioData,
  tombs: string[] = []
): StudioData {
  // Удаления применяем всегда, даже если в базе проект ещё есть
  const alive = <T extends { id: string }>(items: T[]) =>
    items.filter((item) => !tombs.includes(item.id));

  if (!base) {
    // Сравнивать не с чем — берём локальную версию как есть
    return {
      ...remote,
      catalog: alive(local.catalog || []),
      actors: alive(local.actors || []),
      news: local.news || remote.news,
    };
  }

  // --- каталог
  const baseById = new Map((base.catalog || []).map((i) => [i.id, i]));
  const localById = new Map((local.catalog || []).map((i) => [i.id, i]));
  const remoteCatalog = alive(remote.catalog || []);

  const changed = (local.catalog || []).filter((item) => {
    const before = baseById.get(item.id);
    return !before || JSON.stringify(before) !== JSON.stringify(item);
  });
  const changedById = new Map(changed.map((i) => [i.id, i]));
  const deleted = (base.catalog || [])
    .filter((item) => !localById.has(item.id))
    .map((item) => item.id);

  const mergedCatalog = remoteCatalog
    .filter((item) => !deleted.includes(item.id))
    .map((item) => changedById.get(item.id) ?? item);

  // Новые проекты, которых в базе ещё нет
  for (const item of changed) {
    if (!mergedCatalog.some((r) => r.id === item.id)) mergedCatalog.push(item);
  }

  // --- актёры (та же логика)
  const baseActors = new Map((base.actors || []).map((i) => [i.id, i]));
  const localActors = new Map((local.actors || []).map((i) => [i.id, i]));
  const changedActors = (local.actors || []).filter((item) => {
    const before = baseActors.get(item.id);
    return !before || JSON.stringify(before) !== JSON.stringify(item);
  });
  const changedActorsById = new Map(changedActors.map((i) => [i.id, i]));
  const deletedActors = (base.actors || [])
    .filter((item) => !localActors.has(item.id))
    .map((item) => item.id);

  const mergedActors = alive(remote.actors || [])
    .filter((item) => !deletedActors.includes(item.id))
    .map((item) => changedActorsById.get(item.id) ?? item);
  for (const item of changedActors) {
    if (!mergedActors.some((r) => r.id === item.id)) mergedActors.push(item);
  }

  // --- новости: простое объединение по id (удаления не отслеживаем)
  const remoteNews = remote.news || [];
  const localNews = local.news || [];
  const baseNewsIds = new Set((base.news || []).map((n) => n.id));
  const newsChanged = localNews.filter((n) => {
    const before = (base.news || []).find((b) => b.id === n.id);
    return !before || JSON.stringify(before) !== JSON.stringify(n);
  });
  const mergedNews = remoteNews
    .filter((n) => !baseNewsIds.has(n.id) || localNews.some((l) => l.id === n.id))
    .map((n) => newsChanged.find((c) => c.id === n.id) ?? n);
  for (const n of newsChanged) {
    if (!mergedNews.some((r) => r.id === n.id)) mergedNews.push(n);
  }

  return {
    catalog: mergedCatalog,
    actors: mergedActors,
    news: mergedNews.length ? mergedNews : remoteNews,
    settings: local.settings ?? remote.settings,
  };
}
