import { RoomApp } from '@/src/client/RoomApp';

export default async function RoomPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <RoomApp slug={slug} />;
}
