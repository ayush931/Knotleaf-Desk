import React, { ReactNode } from "react";

interface IconButtonProps {
  icon: ReactNode;
  onClick: () => void;
  activated: boolean;
}

export const IconButton = React.memo(function IconButton({
  icon,
  onClick,
  activated,
}: IconButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`cursor-pointer rounded-full border p-3 flex items-center justify-center transition-all duration-200 ${
        activated
          ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/30 scale-105"
          : "bg-neutral-800 border-neutral-700 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700"
      }`}
    >
      {icon}
    </button>
  );
});

IconButton.displayName = "IconButton";
