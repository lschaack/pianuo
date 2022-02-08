import { useCallback, useState, useEffect, useRef } from 'react';

const INIT_DRAG_START = -1;

export const useDrag = (handleDrag: (dx: number) => void) => {
  const [ isDragging, setIsDragging ] = useState(false);
  const dragStart = useRef(INIT_DRAG_START);

  const handleMouseUp = () => setIsDragging(false);

  const handleMouseMove = useCallback((e: globalThis.MouseEvent) => {
    e.preventDefault();

    if (dragStart.current > INIT_DRAG_START) {
      const dx = e.clientX - dragStart.current;

      handleDrag(dx);
    }

    dragStart.current = e.clientX;
  }, [handleDrag]);

  useEffect(() => {
    const stopDragging = () => {
      dragStart.current = INIT_DRAG_START;
      handleMouseUp();
    }

    if (isDragging) {
      globalThis.addEventListener('mouseup', stopDragging);
      globalThis.addEventListener('mousemove', handleMouseMove);
    }

    return () => {
      globalThis.removeEventListener('mouseup', stopDragging);
      globalThis.removeEventListener('mousemove', handleMouseMove);
    }
  }, [ isDragging ]); // eslint-disable-line

  return { setIsDragging };
}
