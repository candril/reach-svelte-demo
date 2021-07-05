import React, { FC, useEffect, useRef } from "react";

export const SvelteComponent: FC<{ component: any; props: any }> = ({
  component,
  ...props
}) => {
  const hostRef = useRef();
  const instanceRef = useRef(null);

  useEffect(() => {
    if (instanceRef.current == null) {
      instanceRef.current = new component({ target: hostRef.current, props });
    }

    return () => instanceRef?.current?.$destroy();
  }, []);

  useEffect(() => {
    if (instanceRef.current != null) {
      instanceRef.current.$$set(props);
    }
  }, Object.values(props));

  return <div ref={hostRef} />;
};
