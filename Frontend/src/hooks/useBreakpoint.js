import { useEffect, useState } from 'react';

// Simple breakpoint hook returning 'sm' for narrow screens and 'md' for wider
export default function useBreakpoint() {
  const getBp = () => (typeof window !== 'undefined' && window.innerWidth < 768 ? 'sm' : 'md');
  const [bp, setBp] = useState(getBp());

  useEffect(() => {
    const onResize = () => setBp(getBp());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return { bp };
}
