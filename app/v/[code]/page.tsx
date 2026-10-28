import { notFound } from 'next/navigation';
import { RoomCanvas } from '@/components/RoomCanvas';
import { roomIdFromCode } from '@/lib/shortRoomCode';
export default async function ShortRoomPage({params}:{params:Promise<{code:string}>}) {
  const id=roomIdFromCode((await params).code);
  if(!id)notFound();
  return <RoomCanvas roomId={id}/>;
}
