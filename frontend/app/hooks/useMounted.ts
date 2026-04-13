import * as React from "react";

/**
 * Returns a ref that is true only after the component has mounted.
 * Use to safely call imperative Framer Motion methods (controls.set, etc).
 */
export function useMounted() {
  const mounted = React.useRef(false);
  React.useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  return mounted;
}
