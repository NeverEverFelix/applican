type DragRefs = {
  current: HTMLDivElement | null;
};

type DragContainerRef = {
  current: HTMLElement | null;
};

type DragEditorRef = {
  current: HTMLElement | null;
};

declare const Draggable: {
  create: (
    target: HTMLDivElement | null,
    options: {
      type: "x";
      bounds: HTMLElement | null;
      inertia: boolean;
      onDrag: (this: { x: number }) => void;
    },
  ) => void;
};

declare const dividerRef: DragRefs;
declare const containerRef: DragContainerRef;
declare const editorRef: DragEditorRef;
declare const initialEditorWidth: number;

Draggable.create(dividerRef.current, {
  type: "x",
  bounds: containerRef.current,
  inertia: false,
  onDrag: function () {
    if (!containerRef.current || !editorRef.current) {
      return;
    }

    const containerWidth = containerRef.current.offsetWidth;
    const dividerX = this.x;

    const minEditorWidth = 350;
    const minPreviewWidth = 350;

    const clampedEditorWidth = Math.max(
      minEditorWidth,
      Math.min(containerWidth - minPreviewWidth, initialEditorWidth + dividerX),
    );

    editorRef.current.style.width = `${clampedEditorWidth}px`;
  },
});
