import { useEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/** A new screen opens at its top. Going back leaves the browser to put you where you were. */
export function ScrollToTop() {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();
  useEffect(() => {
    if (navigationType !== 'POP') window.scrollTo(0, 0);
  }, [pathname, navigationType]);
  return null;
}
