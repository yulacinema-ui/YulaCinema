export const snapshotToArray = (snapshot) => {
  const array = [];
  snapshot.forEach((child) => {
    array.push({ id: child.key, ...child.val() });
  });
  return array;
};