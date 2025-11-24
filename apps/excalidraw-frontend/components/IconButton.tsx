import { ReactNode } from "react";

export function IconButton({
  icon, onClick, activated
}: {
  icon: ReactNode,
  onClick: () => void,
  activated: boolean
}) {
  return (
    <div onClick={onClick} className={`cursor-pointer rounded-full border p-2 bg-black ${activated ? 'text-red-500' : 'text-white'} hover:bg-gray-400`}>
      {icon}
    </div>
  )
}