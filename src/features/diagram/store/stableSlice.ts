/**
 * Selectors that pick a fixed set of store keys and keep the object identity.
 *
 * `useShallow((s) => ({ a: s.a, b: s.b, ... }))` allocates a fresh object every
 * time it runs and then compares it with zustand's `shallow`, which for a plain
 * object falls through to `compareEntries` — two `Object.entries` arrays and two
 * `Map`s per call. React re-runs a selector on every render of the subscribing
 * component *and* on every store notification, so an action bag read once per
 * edge became the largest single JS cost of a drag: 2.8 s of 18 s (15.7%) at
 * 600 nodes, plus the garbage it produced.
 *
 * The keys are known up front, so the comparison can be a plain loop with no
 * allocation, and the object only has to be rebuilt when one of the values
 * actually changes — which for actions is never, outside tests that swap them.
 *
 * Create the selectors once at module scope: a stable selector identity also
 * stops zustand from handing React a new `getSnapshot` on every render.
 *
 *   const pick = createStableSlice<MyStore>();
 *   const selectActions = pick(["addThing", "removeThing"]);
 *   export const useThingActions = () => useMyStore(selectActions);
 */
export function createStableSlice<State>() {
  return function stableSlice<const Keys extends readonly (keyof State)[]>(
    keys: Keys,
  ): (state: State) => Pick<State, Keys[number]> {
    let cached: Pick<State, Keys[number]> | null = null;

    return (state) => {
      if (cached !== null) {
        let unchanged = true;
        for (const key of keys) {
          if (cached[key] !== state[key]) {
            unchanged = false;
            break;
          }
        }
        if (unchanged) return cached;
      }

      const next = {} as Pick<State, Keys[number]>;
      for (const key of keys) {
        next[key] = state[key];
      }
      cached = next;
      return next;
    };
  };
}
