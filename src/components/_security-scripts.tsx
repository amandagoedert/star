"use client";

import { addListener, isLaunch, launch, stop } from "devtools-detector";
import { useEffect } from "react";

export function SecurityScripts() {
  useEffect(() => {
    document.body.style.userSelect = "none";
    document.body.ondragstart = (e) => e.preventDefault();
    document.addEventListener("contextmenu", (e) => e.preventDefault());

    const preventGesture = (e: Event) => e.preventDefault();
    document.addEventListener("gesturestart", preventGesture);
    document.addEventListener("gesturechange", preventGesture);
    document.addEventListener("gestureend", preventGesture);

    document.addEventListener(
      "wheel",
      (e) => {
        if ((e as WheelEvent).ctrlKey) e.preventDefault();
      },
      { passive: false }
    );

    document.addEventListener("keydown", (e) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        ["+", "-", "=", "_", "Add", "Subtract"].includes(e.key)
      ) {
        e.preventDefault();
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.ctrlKey && ["u", "U", "s", "S", "c", "C"].includes(e.key)) {
        e.preventDefault();
      }
      if (
        e.key === "F12" ||
        (e.ctrlKey && e.shiftKey && ["I", "i", "J", "j"].includes(e.key))
      ) {
        e.preventDefault();
      }
    });

    const handleDevtoolsOpen = (isOpen: boolean) => {
      if (isOpen) {
        document.body.innerHTML = "";
      }
    };

    addListener(handleDevtoolsOpen);
    launch();

    const interval = setInterval(() => {
      if (!isLaunch()) {
        launch();
      }
    }, 1000);

    return () => {
      stop();
      clearInterval(interval);

      document.removeEventListener("gesturestart", preventGesture);
      document.removeEventListener("gesturechange", preventGesture);
      document.removeEventListener("gestureend", preventGesture);
    };
  }, []);

  return null;
}
