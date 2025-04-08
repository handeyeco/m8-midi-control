export function arraysMatch(a1: ReadonlyArray<number>, a2: ReadonlyArray<number>) {
  if (!a1.length || !a2.length || a1.length !== a2.length) return false;

  for (let i = 0; i < a1.length; i++) {
    if (a1[i] !== a2[i]) return false;
  }

  return true;
}